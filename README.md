# 📍 Tradutor Reverso de Localização & Ponte para Mapa de Cadastros

**Idealizador e Desenvolvedor Original:** Scheneider Pereira dos Santos  
**Status:** Funcional (Painel Web + Extensão Chrome/Edge Manifest V3)

---

## 🎯 Objetivo do Projeto
Automatizar e acelerar a identificação exata de endereços e coordenadas enviados de forma não padronizada em solicitações operacionais (WhatsApp), integrando a localização diretamente ao **Mapa de Cadastros (ArcGIS)** para rápida identificação de matrículas.

## ⚙️ Funcionalidades Principais
1. **Leitura Inteligente de Mensagens (Parser):**
   - Extrai automaticamente logradouro, número, bairro, município e dados operacionais da solicitação com um simples `Ctrl+V` ou *Drag & Drop*.
   - Reconhece siglas de logradouros (`ETR`, `AVN`, `TRV`, etc.), esquinas (`ESQ.`) e separa municípios embutidos na linha de bairro.
2. **Motor Híbrido de Geocodificação e Correção:**
   - Converte automaticamente variações numéricas e por extenso (ex: *Rua 2* ➔ *Rua Dois*).
   - Cruza dados da API **Esri ArcGIS** e **OpenStreetMap (Nominatim)** com pontuação por semelhança de palavras e validação de número de porta.
   - Identifica até **4 locais candidatos** quando existem ruas homônimas no mesmo bairro/município, permitindo ajuste fino arrastando o pino no mapa.
3. **Extensão de Navegador (Chrome / Edge - Manifest V3):**
   - Faz a ponte direta entre o painel HTML e a aba ativa do **Mapa de Cadastros**.
   - Move a câmera do ArcGIS para a coordenada exata (Zoom 19), aplica marcador 3D pulsante (sem bloquear o clique nas feições do mapa) e preenche a barra de busca nativa.

## 📂 Estrutura do Repositório
- `index.html`: Interface principal do Tradutor Reverso (HTML5, CSS3, JavaScript, Leaflet.js).
- `/plugin-aegea-cadastro`: Extensão do navegador (Manifest V3) composta por:
  - `manifest.json`
  - `content_bridge.js`
  - `background.js`
