# 🇧🇷 Painel de Apuração Eleitoral Brasil

Aplicação leve e em tempo real para acompanhamento da apuração dos votos das eleições no Brasil, consumindo dados oficiais do **TSE (Tribunal Superior Eleitoral)** e com visualização interativa do **mapa do Brasil em SVG**.

Inspirado na arquitetura do projeto *Varrendo a Esquerda*, este projeto utiliza uma arquitetura **BFF (Backend-For-Frontend)** em JavaScript puro (Vanilla) no cliente e servidor serverless/Node.js, garantindo máxima performance, zero dependências pesadas e facilidade de deploy.

---

## 🚀 Funcionalidades

* **Mapa do Brasil Interativo (SVG)**:
  * 27 Unidades Federativas com caminhos vetoriais de alta precisão.
  * Coloração dinâmica do estado baseada na cor/partido do candidato líder.
  * Tooltip com total de seções apuradas e votos do 1º e 2º colocado ao passar o mouse.
  * Clique no estado para filtrar e exibir a apuração detalhada daquela UF.
* **Placar de Resultados**:
  * Barra de duelo comparativa entre os dois candidatos mais votados.
  * Ranking completo com número, partido/coligação, total de votos nominais e percentual de votos válidos.
  * Indicadores de status ("Eleito", "2º Turno", "Em apuração").
* **Arquitetura em Tempo Real**:
  * Suporte a **Server-Sent Events (SSE)** em `/api/events` para streaming de atualizações.
  * Fallback automático para **Polling inteligente** em `/api/state` a cada 15-30s.
  * Temporizador com contagem regressiva para a próxima atualização.
* **Modo Demonstração / Simulação**:
  * Permite testar e visualizar o painel completo a qualquer momento, mesmo fora do dia da eleição ou quando a apuração oficial estiver fechada.
* **Zero Dependências no Servidor**:
  * Roda em qualquer máquina com Node.js instalado sem precisar de `npm install` de pacotes pesados.
* **Pronto para Deploy no Cloudflare Pages**:
  * Inclui adaptadores em `functions/api/` para publicação direta e gratuita no Cloudflare Pages.

---

## 📁 Estrutura do Projeto

```
painel-apuracao-tse/
├── public/
│   ├── index.html           # Interface principal HTML5
│   ├── css/
│   │   └── style.css        # Estilos modernos e responsivos (tema dark)
│   └── js/
│       ├── map-data.js      # Coordenadas vetoriais SVG e centróides das 27 UFs
│       └── app.js           # Lógica do mapa, filtros, placar e conexões SSE/REST
├── data/
│   └── mock-data.js         # Gerador de dados de simulação para desenvolvimento
├── src/
│   ├── tse-client.js        # Cliente HTTP com cache para a CDN oficial do TSE
│   └── aggregator.js        # Orquestrador de dados e transmissor SSE
├── functions/
│   └── api/
│       └── state.js         # Handler serverless para Cloudflare Pages Functions
├── server.js                # Servidor HTTP nativo Node.js
├── package.json
└── README.md
```

---

## 💻 Como Executar Localmente

### 1. Iniciar o servidor
Na pasta do projeto, execute:

```bash
npm start
# ou diretamente:
node server.js
```

### 2. Acessar no navegador
Abra seu navegador em:
👉 **`http://localhost:3000`**

* Para abrir direto no **Modo Simulação**:
  `http://localhost:3000/?mode=fake`

---

## 📡 Como Funciona a API do TSE

Durante o período eleitoral, o TSE disponibiliza arquivos JSON estáticos em CDN aberta de alta performance:

* **Domínio CDN:** `https://resultados.tse.jus.br/oficial/`
* **Padrão de URL de Dados Simplificados:**
  ```text
  https://resultados.tse.jus.br/oficial/ele[ANO]/[CODIGO_PLEITO]/dados-simplificados/[UF]/[UF]-c[COD_CARGO]-e000[CODIGO_PLEITO]-r.json
  ```
* **Códigos de Cargo mais comuns:**
  * `0001`: Presidente da República (âmbito BR)
  * `0003`: Governador de Estado (âmbito UF)
  * `0005`: Senador (âmbito UF)
  * `0006`: Deputado Federal (âmbito UF)
  * `0007`: Deputado Estadual (âmbito UF)

O módulo `src/tse-client.js` consome essas URLs, aplicando um cache em memória de 25 segundos para respeitar rigorosamente as políticas de taxa de requisições do TSE e evitar bloqueios de IP.

---

## ☁️ Como Fazer Deploy no Cloudflare Pages (Gratuito)

1. Suba este projeto para um repositório no seu GitHub.
2. Acesse o painel do [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecione o repositório.
4. Nas configurações de Build:
   * **Framework preset:** `None`
   * **Build command:** *(deixe em branco)*
   * **Build output directory:** `public`
5. Clique em **Save and Deploy**.

O Cloudflare Pages servirá a pasta `public` como site estático e reconhecerá a pasta `functions/api/` automaticamente como Serverless Functions!
