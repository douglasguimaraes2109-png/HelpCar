// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAr2WewAfeddazQLBpV-JId3Tmq9Tx8s_M",
  authDomain: "helpcardb.firebaseapp.com",
  projectId: "helpcardb",
  storageBucket: "helpcardb.firebasestorage.app",
  messagingSenderId: "865693923703",
  appId: "1:865693923703:web:7f41059397c44ff85e4972",
  measurementId: "G-J33QTYLZN6"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let usuarioLogado = null;

// ==========================================
// 2. CONTROLE DE AUTENTICAÇÃO
// ==========================================
auth.onAuthStateChanged(user => {
    const userInfo = document.getElementById('userInfo');
    const btnAuth = document.getElementById('btnAuth');
    const secaoHistorico = document.getElementById('secaoHistorico');

    if (user) {
        usuarioLogado = user;
        userInfo.innerHTML = `👤 <strong>${user.email}</strong>`;
        btnAuth.textContent = "Sair";
        btnAuth.onclick = () => auth.signOut();
        secaoHistorico.style.display = 'block';
        carregarHistoricoDoBanco();
    } else {
        usuarioLogado = null;
        userInfo.innerHTML = "Modo Visitante";
        btnAuth.textContent = "Entrar / Cadastrar";
        btnAuth.onclick = gerenciarLogin;
        secaoHistorico.style.display = 'none';
    }
});

function gerenciarLogin() {
    const email = prompt("Digite seu e-mail:");
    if (!email) return;

    const senha = prompt("Digite sua senha:");
    if (!senha) return;

    auth.signInWithEmailAndPassword(email, senha)
        .then(() => alert("Login realizado com sucesso!"))
        .catch(error => {
            if (error.code === 'auth/user-not-found' || confirm("Conta não encontrada. Deseja criar uma conta com esses dados?")) {
                auth.createUserWithEmailAndPassword(email, senha)
                    .then(() => alert("Conta criada e conectada com sucesso!"))
                    .catch(err => alert("Erro ao criar conta: " + err.message));
            }
        });
}

// ==========================================
// 3. API FIPE E CHECKLIST
// ==========================================
const API_FIPE_URL = "https://parallelum.com.br/fipe/api/v1/carros";

const manutencaoPadrao = [
    { kmIntervalo: 10000, item: "Troca de Óleo do Motor + Filtro", desc: "Verificar especificação e viscosidade recomendada no manual.", cat: "Básico" },
    { kmIntervalo: 10000, item: "Filtro de Ar do Motor e Combustível", desc: "Substituição para evitar consumo excessivo de combustível.", cat: "Injeção" },
    { kmIntervalo: 20000, item: "Velas de Ignição", desc: "Checar desgaste dos eletrodos para garantir boa queima.", cat: "Ignição" },
    { kmIntervalo: 20000, item: "Pastilhas de Freio e Fluido DOT4", desc: "Inspecionar espessura das pastilhas e contaminação do fluido.", cat: "Freios" },
    { kmIntervalo: 30000, item: "Limpeza do Sistema de Arrefecimento", desc: "Troca do líquido com aditivo na proporção correta.", cat: "Arrefecimento" },
    { kmIntervalo: 40000, item: "Correia Dentada e Tensor (se aplicável)", desc: "Verificação preventiva essencial para evitar quebra do motor.", cat: "Motor" },
    { kmIntervalo: 50000, item: "Amortecedores e Kit Suspensão", desc: "Avaliar vazamentos, folgas em buchas, pivôs e bieletas.", cat: "Suspensão" },
    { kmIntervalo: 80000, item: "Kit de Embreagem / Fluido do Câmbio", desc: "Checar altura do pedal ou troca de fluido da transmissão.", cat: "Transmissão" }
];

document.addEventListener("DOMContentLoaded", () => {
    carregarMarcas();

    document.getElementById('marca').addEventListener('change', carregarModelos);
    document.getElementById('btnBuscar').addEventListener('click', gerarChecklist);
    document.getElementById('btnExportarPdf').addEventListener('click', () => window.print());
    document.getElementById('btnSalvarHistorico').addEventListener('click', salvarHistoricoNoBanco);
    document.getElementById('btnCarregarHistorico').addEventListener('click', carregarHistoricoDoBanco);
});

async function carregarMarcas() {
    const selectMarca = document.getElementById('marca');
    try {
        const response = await fetch(`${API_FIPE_URL}/marcas`);
        const marcas = await response.json();

        selectMarca.innerHTML = '<option value="">-- Escolha a Marca --</option>';
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.codigo;
            option.textContent = marca.nome;
            selectMarca.appendChild(option);
        });
    } catch (error) {
        selectMarca.innerHTML = '<option value="">Erro ao carregar marcas</option>';
    }
}

async function carregarModelos() {
    const codigoMarca = document.getElementById('marca').value;
    const selectModelo = document.getElementById('modelo');

    if (!codigoMarca) {
        selectModelo.innerHTML = '<option value="">Selecione uma marca primeiro</option>';
        selectModelo.disabled = true;
        return;
    }

    selectModelo.disabled = true;
    selectModelo.innerHTML = '<option value="">Carregando modelos...</option>';

    try {
        const response = await fetch(`${API_FIPE_URL}/marcas/${codigoMarca}/modelos`);
        const data = await response.json();

        selectModelo.innerHTML = '<option value="">-- Escolha o Modelo --</option>';
        data.modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.nome;
            option.textContent = modelo.nome;
            selectModelo.appendChild(option);
        });
        selectModelo.disabled = false;
    } catch (error) {
        selectModelo.innerHTML = '<option value="">Erro ao carregar modelos</option>';
    }
}

function gerarChecklist() {
    const selectMarca = document.getElementById('marca');
    const marcaNome = selectMarca.options[selectMarca.selectedIndex]?.text || '';
    const modeloNome = document.getElementById('modelo').value;
    const kmAtual = parseInt(document.getElementById('km').value) || 0;
    const listaDiv = document.getElementById('listaManutencao');
    const btnPdf = document.getElementById('btnExportarPdf');
    const btnSalvar = document.getElementById('btnSalvarHistorico');
    const infoPdf = document.getElementById('infoVeiculoPdf');

    listaDiv.innerHTML = "";

    if (!modeloNome || kmAtual <= 0) {
        listaDiv.innerHTML = `<div class="empty-msg">Selecione o veículo e digite uma quilometragem válida.</div>`;
        btnPdf.style.display = 'none';
        btnSalvar.style.display = 'none';
        return;
    }

    infoPdf.innerHTML = `<strong>Veículo:</strong> ${marcaNome} - ${modeloNome} <br><strong>Odômetro:</strong> ${kmAtual.toLocaleString('pt-BR')} km`;

    const pendencias = manutencaoPadrao.filter(item => {
        return (kmAtual % item.kmIntervalo === 0) || (kmAtual >= item.kmIntervalo);
    });

    pendencias.forEach((task, index) => {
        const proximaKm = (Math.floor(kmAtual / task.kmIntervalo) + 1) * task.kmIntervalo;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item';
        itemDiv.id = `task-container-${index}`;

        itemDiv.innerHTML = `
            <input type="checkbox" id="check-${index}" data-title="${task.item}">
            <div class="task-content">
                <label for="check-${index}" class="task-title">${task.item}</label>
                <div class="task-desc">${task.desc}</div>
                <div style="margin-top: 6px;">
                    <span class="task-tag">${task.cat} • A cada ${task.kmIntervalo.toLocaleString('pt-BR')} km</span>
                    <span class="proxima-revisao-tag">📌 Próxima troca: <strong>${proximaKm.toLocaleString('pt-BR')} km</strong></span>
                </div>
            </div>
        `;
        listaDiv.appendChild(itemDiv);

        const checkbox = itemDiv.querySelector(`#check-${index}`);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                itemDiv.classList.add('completed');
            } else {
                itemDiv.classList.remove('completed');
            }
        });
    });

    btnPdf.style.display = 'block';
    btnSalvar.style.display = 'block';
}

// ==========================================
// 4. BANCO DE DADOS: SALVAR E BUSCAR HISTÓRICO
// ==========================================
async function salvarHistoricoNoBanco() {
    if (!usuarioLogado) {
        alert("Você precisa estar logado para salvar no histórico!");
        gerenciarLogin();
        return;
    }

    const selectMarca = document.getElementById('marca');
    const marcaNome = selectMarca.options[selectMarca.selectedIndex]?.text || '';
    const modeloNome = document.getElementById('modelo').value;
    const kmAtual = parseInt(document.getElementById('km').value) || 0;

    const checkboxes = document.querySelectorAll('#listaManutencao input[type="checkbox"]:checked');
    const itensConcluidos = Array.from(checkboxes).map(cb => cb.getAttribute('data-title'));

    try {
        await db.collection("users").doc(usuarioLogado.uid).collection("historico").add({
            veiculo: `${marcaNome} - ${modeloNome}`,
            odometro: kmAtual,
            itensConcluidos: itensConcluidos,
            dataRegistro: new Date().toLocaleDateString('pt-BR')
        });

        alert("Revisão salva no seu histórico com sucesso!");
        carregarHistoricoDoBanco(); // Atualiza a lista na tela imediatamente
    } catch (error) {
        alert("Erro ao salvar histórico: " + error.message);
    }
}

let historicoIdEmEdicao = null; // Guarda o ID se estivermos editando um registro existente

async function carregarHistoricoDoBanco() {
    if (!usuarioLogado) return;

    const listaDiv = document.getElementById('listaHistorico');
    listaDiv.innerHTML = "<div style='color: var(--text-dim); font-size: 0.9em;'>Carregando históricos...</div>";

    try {
        const snapshot = await db.collection("users").doc(usuarioLogado.uid).collection("historico").get();

        if (snapshot.empty) {
            listaDiv.innerHTML = "<div class='empty-msg'>Nenhum registro de manutenção salvo ainda.</div>";
            return;
        }

        listaDiv.innerHTML = "";

        snapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;

            const card = document.createElement('div');
            card.style.cssText = "background: #0f172a; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 10px;";

            const itensHtml = data.itensConcluidos && data.itensConcluidos.length > 0 
                ? data.itensConcluidos.map(item => `<li>✓ ${item}</li>`).join('') 
                : '<li style="color: var(--text-dim);">Nenhum item marcado como concluído</li>';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 0.95em; color: var(--accent);">
                    <span>🚗 ${data.veiculo}</span>
                    <span style="color: var(--text-dim); font-size: 0.85em;">📅 ${data.dataRegistro}</span>
                </div>
                <div style="font-size: 0.85em; color: var(--text-dim); margin-top: 4px;">
                    Odômetro: <strong>${data.odometro.toLocaleString('pt-BR')} km</strong>
                </div>
                <ul style="margin: 8px 0 8px 0; padding-left: 0; font-size: 0.85em; color: #22c55e; list-style-type: none;">
                    ${itensHtml}
                </ul>
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    <button type="button" class="btn-recarregar" style="width: auto; padding: 4px 10px; font-size: 0.8em; background: #0284c7; margin: 0;">
                        📂 Carregar no Checklist
                    </button>
                    <button type="button" class="btn-excluir" style="width: auto; padding: 4px 10px; font-size: 0.8em; background: #ef4444; margin: 0;">
                        🗑️ Excluir
                    </button>
                </div>
            `;

            // Ação do Botão "Carregar no Checklist"
            card.querySelector('.btn-recarregar').addEventListener('click', () => {
                recarregarParaFormulario(data, docId);
            });

            // Ação do Botão "Excluir"
            card.querySelector('.btn-excluir').addEventListener('click', () => {
                excluirHistoricoDoBanco(docId);
            });

            listaDiv.appendChild(card);
        });

    } catch (error) {
        listaDiv.innerHTML = "<div style='color: #ef4444; font-size: 0.9em;'>Erro ao carregar histórico: " + error.message + "</div>";
    }
}

// Função para preencher o formulário com os dados do histórico selecionado
async function recarregarParaFormulario(dados, docId) {
    historicoIdEmEdicao = docId;

    // 1. Preenche a Quilometragem
    document.getElementById('km').value = dados.odometro;

    // 2. Separa Marca e Modelo da string (Ex: "VW - VolksWagen - GOL 1.0")
    const partesVeiculo = dados.veiculo.split(" - ");
    const nomeMarca = partesVeiculo[0].trim();
    // O modelo pode conter hífens no nome, então juntamos o restante das partes
    const nomeModelo = partesVeiculo.slice(1).join(" - ").trim();

    const selectMarca = document.getElementById('marca');

    // 3. Procura e seleciona a Marca no <select>
    let marcaEncontrada = false;
    for (let i = 0; i < selectMarca.options.length; i++) {
        const textoOpcao = selectMarca.options[i].text.toLowerCase();
        if (textoOpcao.includes(nomeMarca.toLowerCase())) {
            selectMarca.selectedIndex = i;
            marcaEncontrada = true;
            break;
        }
    }

    // 4. Se a marca foi encontrada, força o carregamento dos modelos na API FIPE
    if (marcaEncontrada) {
        // Aguarda a requisição da API FIPE trazer todos os modelos
        await carregarModelos();

        const selectModelo = document.getElementById('modelo');

        // Procura o modelo exato na lista retornada
        let modeloEncontrado = false;
        for (let i = 0; i < selectModelo.options.length; i++) {
            if (selectModelo.options[i].value.toLowerCase() === nomeModelo.toLowerCase()) {
                selectModelo.selectedIndex = i;
                modeloEncontrado = true;
                break;
            }
        }

        // Se não achou por correspondência exata, tenta encontrar por aproximação
        if (!modeloEncontrado) {
            for (let i = 0; i < selectModelo.options.length; i++) {
                if (selectModelo.options[i].text.toLowerCase().includes(nomeModelo.toLowerCase())) {
                    selectModelo.selectedIndex = i;
                    break;
                }
            }
        }
    }

    // 5. Gera o checklist
    gerarChecklist();

    // 6. Marca os checkboxes dos itens salvos anteriormente
    if (dados.itensConcluidos && dados.itensConcluidos.length > 0) {
        const checkboxes = document.querySelectorAll('#listaManutencao input[type="checkbox"]');
        checkboxes.forEach(cb => {
            if (dados.itensConcluidos.includes(cb.getAttribute('data-title'))) {
                cb.checked = true;
                const container = cb.closest('.task-item');
                if (container) container.classList.add('completed');
            }
        });
    }

    // Rola a página suavemente para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Função para excluir um registro antigo do banco
async function excluirHistoricoDoBanco(docId) {
    if (!confirm("Tem certeza que deseja excluir esta revisão do seu histórico?")) return;

    try {
        await db.collection("users").doc(usuarioLogado.uid).collection("historico").doc(docId).delete();
        alert("Registro excluído com sucesso!");
        carregarHistoricoDoBanco();
    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
}
