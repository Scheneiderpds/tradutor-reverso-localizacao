(function() {
  // Marca que o plugin está instalado nesta página
  document.documentElement.setAttribute('data-aegea-plugin', '1');
  window.postMessage({ type: 'AEGEA_PLUGIN_PONG' }, '*');

  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'AEGEA_PLUGIN_PING') {
      window.postMessage({ type: 'AEGEA_PLUGIN_PONG' }, '*');
    }

    if (event.data.type === 'AEGEA_ENVIAR_PINO_CADASTRO') {
      chrome.runtime.sendMessage({
        action: 'CRAVAR_NO_MAPA_CADASTRO',
        payload: event.data.payload
      }, (resp) => {
        window.postMessage({
          type: 'AEGEA_PLUGIN_RESPOSTA',
          ok: Boolean(resp && resp.ok),
          erro: resp ? resp.erro : null
        }, '*');
      });
    }
  });
})();