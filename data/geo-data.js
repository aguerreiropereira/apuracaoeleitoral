/**
 * Mapeamento Geográfico do Brasil: Capitais e Municípios por Estado
 * Utilizado para a Visão de Desempenho Detalhado de Candidatos.
 */

const CAPITALS = {
  "AC": { name: "Rio Branco", electorate: 270000, code: "01392" },
  "AL": { name: "Maceió", electorate: 590000, code: "27855" },
  "AM": { name: "Manaus", electorate: 1400000, code: "02550" },
  "AP": { name: "Macapá", electorate: 310000, code: "06050" },
  "BA": { name: "Salvador", electorate: 1980000, code: "38490" },
  "CE": { name: "Fortaleza", electorate: 1870000, code: "13897" },
  "DF": { name: "Brasília", electorate: 2200000, code: "97012" },
  "ES": { name: "Vitória", electorate: 275000, code: "57053" },
  "GO": { name: "Goiânia", electorate: 1030000, code: "92754" },
  "MA": { name: "São Luís", electorate: 750000, code: "09210" },
  "MG": { name: "Belo Horizonte", electorate: 1990000, code: "41238" },
  "MS": { name: "Campo Grande", electorate: 650000, code: "90514" },
  "MT": { name: "Cuiabá", electorate: 445000, code: "90123" },
  "PA": { name: "Belém", electorate: 1050000, code: "04278" },
  "PB": { name: "João Pessoa", electorate: 560000, code: "20516" },
  "PE": { name: "Recife", electorate: 1210000, code: "24910" },
  "PI": { name: "Teresina", electorate: 590000, code: "12190" },
  "PR": { name: "Curitiba", electorate: 1420000, code: "75353" },
  "RJ": { name: "Rio de Janeiro", electorate: 5000000, code: "60011" },
  "RN": { name: "Natal", electorate: 580000, code: "17612" },
  "RO": { name: "Porto Velho", electorate: 360000, code: "00035" },
  "RR": { name: "Boa Vista", electorate: 235000, code: "03018" },
  "RS": { name: "Porto Alegre", electorate: 1110000, code: "85995" },
  "SC": { name: "Florianópolis", electorate: 410000, code: "81051" },
  "SE": { name: "Aracaju", electorate: 420000, code: "31054" },
  "SP": { name: "São Paulo", electorate: 9300000, code: "71072" },
  "TO": { name: "Palmas", electorate: 215000, code: "96431" }
};

const CAPITAL_CODES = Object.fromEntries(
  Object.entries(CAPITALS).map(([uf, info]) => [uf, info.code])
);

const STATE_MUNICIPALITIES = {
  "MS": [
    { name: "Campo Grande", isCapital: true, electorate: 650000 },
    { name: "Dourados", isCapital: false, electorate: 165000 },
    { name: "Três Lagoas", isCapital: false, electorate: 90000 },
    { name: "Corumbá", isCapital: false, electorate: 72000 },
    { name: "Ponta Porã", isCapital: false, electorate: 65000 },
    { name: "Naviraí", isCapital: false, electorate: 38000 },
    { name: "Nova Andradina", isCapital: false, electorate: 35000 },
    { name: "Aquidauana", isCapital: false, electorate: 34000 },
    { name: "Sidrolândia", isCapital: false, electorate: 33000 },
    { name: "Paranaíba", isCapital: false, electorate: 31000 },
    { name: "Maracaju", isCapital: false, electorate: 30000 },
    { name: "Amambai", isCapital: false, electorate: 28000 },
    { name: "Coxim", isCapital: false, electorate: 25000 },
    { name: "Rio Brilhante", isCapital: false, electorate: 25000 },
    { name: "Caarapó", isCapital: false, electorate: 22000 },
    { name: "Miranda", isCapital: false, electorate: 20000 },
    { name: "São Gabriel do Oeste", isCapital: false, electorate: 20000 },
    { name: "Anastácio", isCapital: false, electorate: 19000 },
    { name: "Jardim", isCapital: false, electorate: 18000 },
    { name: "Bonito", isCapital: false, electorate: 17500 },
    { name: "Aparecida do Taboado", isCapital: false, electorate: 17000 },
    { name: "Bela Vista", isCapital: false, electorate: 16500 },
    { name: "Ribas do Rio Pardo", isCapital: false, electorate: 16000 },
    { name: "Chapadão do Sul", isCapital: false, electorate: 15500 },
    { name: "Fátima do Sul", isCapital: false, electorate: 15000 }
  ],
  "SP": [
    { name: "São Paulo", isCapital: true, electorate: 9300000 },
    { name: "Guarulhos", isCapital: false, electorate: 910000 },
    { name: "Campinas", isCapital: false, electorate: 880000 },
    { name: "São Bernardo do Campo", isCapital: false, electorate: 640000 },
    { name: "Santo André", isCapital: false, electorate: 580000 },
    { name: "Osasco", isCapital: false, electorate: 570000 },
    { name: "São José dos Campos", isCapital: false, electorate: 540000 },
    { name: "Ribeirão Preto", isCapital: false, electorate: 460000 },
    { name: "Sorocaba", isCapital: false, electorate: 500000 },
    { name: "Santos", isCapital: false, electorate: 350000 },
    { name: "Mauá", isCapital: false, electorate: 330000 },
    { name: "São José do Rio Preto", isCapital: false, electorate: 340000 },
    { name: "Mogi das Cruzes", isCapital: false, electorate: 320000 },
    { name: "Diadema", isCapital: false, electorate: 330000 },
    { name: "Jundiaí", isCapital: false, electorate: 320000 },
    { name: "Piracicaba", isCapital: false, electorate: 310000 },
    { name: "Bauru", isCapital: false, electorate: 275000 },
    { name: "Franca", isCapital: false, electorate: 250000 },
    { name: "Praia Grande", isCapital: false, electorate: 240000 },
    { name: "Itaquaquecetuba", isCapital: false, electorate: 230000 }
  ],
  "RJ": [
    { name: "Rio de Janeiro", isCapital: true, electorate: 5000000 },
    { name: "São Gonçalo", isCapital: false, electorate: 670000 },
    { name: "Duque de Caxias", isCapital: false, electorate: 660000 },
    { name: "Nova Iguaçu", isCapital: false, electorate: 600000 },
    { name: "Niterói", isCapital: false, electorate: 410000 },
    { name: "Belford Roxo", isCapital: false, electorate: 360000 },
    { name: "Campos dos Goytacazes", isCapital: false, electorate: 380000 },
    { name: "São João de Meriti", isCapital: false, electorate: 380000 },
    { name: "Petrópolis", isCapital: false, electorate: 245000 },
    { name: "Volta Redonda", isCapital: false, electorate: 225000 },
    { name: "Macaé", isCapital: false, electorate: 180000 },
    { name: "Magé", isCapital: false, electorate: 190000 },
    { name: "Itaboraí", isCapital: false, electorate: 175000 },
    { name: "Cabo Frio", isCapital: false, electorate: 165000 },
    { name: "Angra dos Reis", isCapital: false, electorate: 140000 }
  ],
  "MG": [
    { name: "Belo Horizonte", isCapital: true, electorate: 1990000 },
    { name: "Uberlândia", isCapital: false, electorate: 530000 },
    { name: "Contagem", isCapital: false, electorate: 460000 },
    { name: "Juiz de Fora", isCapital: false, electorate: 400000 },
    { name: "Betim", isCapital: false, electorate: 300000 },
    { name: "Montes Claros", isCapital: false, electorate: 285000 },
    { name: "Ribeirão das Neves", isCapital: false, electorate: 220000 },
    { name: "Uberaba", isCapital: false, electorate: 240000 },
    { name: "Governador Valadares", isCapital: false, electorate: 215000 },
    { name: "Ipatinga", isCapital: false, electorate: 185000 },
    { name: "Sete Lagoas", isCapital: false, electorate: 175000 },
    { name: "Divinópolis", isCapital: false, electorate: 175000 },
    { name: "Poços de Caldas", isCapital: false, electorate: 130000 }
  ],
  "RS": [
    { name: "Porto Alegre", isCapital: true, electorate: 1110000 },
    { name: "Caxias do Sul", isCapital: false, electorate: 345000 },
    { name: "Pelotas", isCapital: false, electorate: 250000 },
    { name: "Canoas", isCapital: false, electorate: 255000 },
    { name: "Santa Maria", isCapital: false, electorate: 210000 },
    { name: "Gravataí", isCapital: false, electorate: 190000 },
    { name: "Viamão", isCapital: false, electorate: 175000 },
    { name: "Novo Hamburgo", isCapital: false, electorate: 180000 },
    { name: "São Leopoldo", isCapital: false, electorate: 165000 },
    { name: "Rio Grande", isCapital: false, electorate: 155000 },
    { name: "Passo Fundo", isCapital: false, electorate: 150000 }
  ],
  "PR": [
    { name: "Curitiba", isCapital: true, electorate: 1420000 },
    { name: "Londrina", isCapital: false, electorate: 395000 },
    { name: "Maringá", isCapital: false, electorate: 300000 },
    { name: "Ponta Grossa", isCapital: false, electorate: 260000 },
    { name: "Cascavel", isCapital: false, electorate: 240000 },
    { name: "São José dos Pinhais", isCapital: false, electorate: 220000 },
    { name: "Foz do Iguaçu", isCapital: false, electorate: 200000 },
    { name: "Colombo", isCapital: false, electorate: 165000 },
    { name: "Guarapuava", isCapital: false, electorate: 135000 },
    { name: "Paranaguá", isCapital: false, electorate: 110000 }
  ]
};

/**
 * Retorna a lista de municípios para um estado
 */
function getMunicipalitiesForUf(ufUpper) {
  if (STATE_MUNICIPALITIES[ufUpper]) {
    return STATE_MUNICIPALITIES[ufUpper];
  }

  // Fallback padrão estruturado para qualquer outro estado
  const cap = CAPITALS[ufUpper] || { name: `Capital de ${ufUpper}`, electorate: 400000 };
  return [
    { name: cap.name, isCapital: true, electorate: cap.electorate },
    { name: "Município Central", isCapital: false, electorate: Math.round(cap.electorate * 0.45) },
    { name: "Município Norte", isCapital: false, electorate: Math.round(cap.electorate * 0.35) },
    { name: "Município Sul", isCapital: false, electorate: Math.round(cap.electorate * 0.3) },
    { name: "Município Leste", isCapital: false, electorate: Math.round(cap.electorate * 0.25) },
    { name: "Município Oeste", isCapital: false, electorate: Math.round(cap.electorate * 0.2) },
    { name: "Região Metropolitana I", isCapital: false, electorate: Math.round(cap.electorate * 0.18) },
    { name: "Região Metropolitana II", isCapital: false, electorate: Math.round(cap.electorate * 0.15) }
  ];
}

module.exports = {
  CAPITALS,
  CAPITAL_CODES,
  STATE_MUNICIPALITIES,
  getMunicipalitiesForUf
};
