chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'CRAVAR_NO_MAPA_CADASTRO') {
    const payload = msg.payload;

    chrome.tabs.query({}, async (tabs) => {
      let targetTab = tabs.find(t =>
        t.id !== (sender.tab ? sender.tab.id : -1) &&
        (
          /mapa de cadastros/i.test(t.title || '') ||
          /cadastro/i.test(t.title || '') ||
          /arcgis|webappbuilder|portal/i.test(t.url || '')
        )
      );

      if (!targetTab) {
        sendResponse({
          ok: false,
          erro: 'Não encontrei a aba do "Mapa de Cadastros" aberta! Deixe o Mapa de Cadastros aberto em uma aba e clique novamente.'
        });
        return;
      }

      await chrome.tabs.update(targetTab.id, { active: true });
      if (targetTab.windowId) {
        await chrome.windows.update(targetTab.windowId, { focused: true });
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          world: 'MAIN',
          args: [payload],
          func: (dados) => {
            const coordStr = dados.lat.toFixed(6) + ', ' + dados.lng.toFixed(6);
            const endBusca = dados.rua + ', ' + dados.cidade;

            // 1. Localiza a caixa da lupa do Mapa de Cadastros
            const seletoresInput = [
              '.arcgisSearch .searchInput',
              '.jimu-widget-search input.searchInput',
              'input.searchInput',
              'input[placeholder*="Pesquisar"]',
              'input[placeholder*="Search"]'
            ];
            let inputEl = null;
            for (const s of seletoresInput) {
              const achou = document.querySelector(s);
              if (achou) { inputEl = achou; break; }
            }

            // 2. Cria o Pino Visual 3D Flutuante (Não bloqueia o clique nas bolinhas azuis!)
            if (!document.getElementById('aegea-pin-style')) {
              const st = document.createElement('style');
              st.id = 'aegea-pin-style';
              st.innerHTML = `
                @keyframes aegeaPulse {
                  0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
                  100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
                }
                @keyframes aegeaBounce {
                  0%, 100% { transform: translate(-50%, -100%) translateY(0); }
                  50% { transform: translate(-50%, -100%) translateY(-6px); }
                }
                #aegea-overlay-pin {
                  position: fixed;
                  z-index: 999990;
                  pointer-events: none;
                  left: 50%;
                  top: 50%;
                }
                .aegea-pin-ring {
                  position: absolute;
                  width: 44px;
                  height: 44px;
                  border: 4px solid #f59e0b;
                  background: rgba(239, 68, 68, 0.25);
                  border-radius: 50%;
                  transform: translate(-50%, -50%);
                  animation: aegeaPulse 1.5s infinite ease-out;
                }
                .aegea-pin-cross {
                  position: absolute;
                  width: 12px;
                  height: 12px;
                  background: #ef4444;
                  border: 2px solid #ffffff;
                  border-radius: 50%;
                  transform: translate(-50%, -50%);
                  box-shadow: 0 0 8px #000;
                }
                .aegea-pin-svg {
                  position: absolute;
                  transform: translate(-50%, -100%);
                  animation: aegeaBounce 1.4s infinite ease-in-out;
                  filter: drop-shadow(0 6px 8px rgba(0,0,0,0.65));
                }
                .aegea-pin-label {
                  position: absolute;
                  bottom: 54px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: #0b1f3f;
                  color: #ffffff;
                  border: 2px solid #f59e0b;
                  padding: 4px 10px;
                  border-radius: 6px;
                  font-family: Arial, sans-serif;
                  font-size: 12px;
                  font-weight: bold;
                  white-space: nowrap;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                }
              `;
              document.head.appendChild(st);
            }

            let pinOverlay = document.getElementById('aegea-overlay-pin');
            if (!pinOverlay) {
              pinOverlay = document.createElement('div');
              pinOverlay.id = 'aegea-overlay-pin';
              document.body.appendChild(pinOverlay);
            }

            pinOverlay.innerHTML = `
              <div class="aegea-pin-ring"></div>
              <div class="aegea-pin-cross"></div>
              <div class="aegea-pin-svg">
                <div class="aegea-pin-label">📍 ${dados.rua}</div>
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                  <circle cx="12" cy="9" r="3" fill="#fde047"/>
                </svg>
              </div>
            `;
            pinOverlay.style.display = 'block';

            // 3. Move o Mapa do ArcGIS e trava o Pino 3D exatamente na coordenada geográfica (acompanha se arrastar o mapa!)
            let moveuViaApiArcgis = false;
            if (typeof window.require === 'function') {
              try {
                window.require([
                  'jimu/MapManager',
                  'esri/geometry/Point',
                  'esri/SpatialReference',
                  'esri/geometry/webMercatorUtils',
                  'esri/graphic',
                  'esri/symbols/SimpleMarkerSymbol',
                  'esri/symbols/SimpleLineSymbol',
                  'esri/Color'
                ], function(MapManager, Point, SpatialReference, webMercatorUtils, Graphic, SimpleMarkerSymbol, SimpleLineSymbol, Color) {
                  const mapInst = MapManager.getInstance() && MapManager.getInstance().map;
                  if (mapInst) {
                    moveuViaApiArcgis = true;
                    const pt4326 = new Point(dados.lng, dados.lat, new SpatialReference({ wkid: 4326 }));
                    const ptMapa = (mapInst.spatialReference && mapInst.spatialReference.isWebMercator && mapInst.spatialReference.isWebMercator())
                      ? webMercatorUtils.geographicToWebMercator(pt4326)
                      : pt4326;

                    window.__aegeaTargetPoint = ptMapa;

                    const atualizarPosicaoPinoTela = () => {
                      if (!window.__aegeaTargetPoint || !pinOverlay || pinOverlay.style.display === 'none') return;
                      try {
                        const sc = mapInst.toScreen(window.__aegeaTargetPoint);
                        const mapRect = mapInst.container ? mapInst.container.getBoundingClientRect() : { left: 0, top: 0 };
                        if (sc) {
                          pinOverlay.style.left = (mapRect.left + sc.x) + 'px';
                          pinOverlay.style.top = (mapRect.top + sc.y) + 'px';
                        }
                      } catch (err) {}
                    };

                    mapInst.centerAndZoom(pt4326, 19).then(() => {
                      atualizarPosicaoPinoTela();
                    });

                    setTimeout(atualizarPosicaoPinoTela, 150);
                    setTimeout(atualizarPosicaoPinoTela, 500);

                    if (!window.__aegeaMapListenersBound) {
                      window.__aegeaMapListenersBound = true;
                      mapInst.on('pan', atualizarPosicaoPinoTela);
                      mapInst.on('pan-end', atualizarPosicaoPinoTela);
                      mapInst.on('zoom-end', atualizarPosicaoPinoTela);
                      mapInst.on('extent-change', atualizarPosicaoPinoTela);
                    }

                    // Também desenha no GraphicsLayer do ArcGIS na projeção WebMercator correta
                    if (mapInst.graphics) {
                      mapInst.graphics.clear();
                      const symHalo = new SimpleMarkerSymbol(
                        SimpleMarkerSymbol.STYLE_CIRCLE, 36,
                        new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([245, 158, 11, 1]), 3),
                        new Color([239, 68, 68, 0.25])
                      );
                      mapInst.graphics.add(new Graphic(ptMapa, symHalo));
                    }
                  }
                });
              } catch (e) {}
            }

            if (inputEl) {
              inputEl.value = moveuViaApiArcgis ? endBusca : coordStr;
              inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 4. Barra de controle no topo para esconder/mostrar o pino ou pesquisar na lupa
            let badge = document.getElementById('aegea-pin-toast');
            if (!badge) {
              badge = document.createElement('div');
              badge.id = 'aegea-pin-toast';
              badge.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); background:#0b1f3f; color:#fff; padding:10px 18px; border-radius:8px; font-family:Arial,sans-serif; font-size:13px; font-weight:bold; z-index:999999; box-shadow:0 6px 20px rgba(0,0,0,0.4); border:2px solid #f59e0b; display:flex; align-items:center; gap:10px;';
              document.body.appendChild(badge);
            }
            badge.innerHTML = '<span>🎯 Pino Cravado: <b style="color:#fbbf24;">' + dados.rua + '</b> (' + dados.bairro + ')</span>' +
                              '<button id="aegea-btn-toggle-pin" style="background:#ef4444; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:bold;">Ocultar/Mostrar Pino</button>' +
                              '<button id="aegea-btn-lupa-forcar" style="background:#2563eb; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:bold;">Pesquisar na Lupa</button>' +
                              '<span id="aegea-close-toast" style="cursor:pointer; opacity:0.8; padding-left:4px;">✕</span>';
            badge.style.display = 'flex';

            document.getElementById('aegea-btn-toggle-pin').onclick = () => {
              pinOverlay.style.display = pinOverlay.style.display === 'none' ? 'block' : 'none';
            };
            document.getElementById('aegea-close-toast').onclick = () => {
              badge.style.display = 'none';
              pinOverlay.style.display = 'none';
            };
            document.getElementById('aegea-btn-lupa-forcar').onclick = () => {
              if (inputEl) {
                inputEl.focus();
                inputEl.value = endBusca;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                const btnBusca = document.querySelector('.arcgisSearch .searchBtn, .jimu-widget-search .searchBtn, .searchSubmit');
                if (btnBusca) btnBusca.click();
              }
            };
          }
        });

        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, erro: 'Erro ao injetar no Mapa de Cadastros: ' + err.message });
      }
    });

    return true;
  }
});