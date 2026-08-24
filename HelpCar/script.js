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

    const selectMarca = document.getElementById('marca');
    const btnBuscar = document.getElementById('btnBuscar');
    const btnExportarPdf = document.getElementById('btnExportarPdf');

    selectMarca.addEventListener('change', carregarModelos);
    btnBuscar.addEventListener('click', gerarChecklist);
    btnExportarPdf.addEventListener('click', gerarRelatorioPDF);
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
    const infoPdf = document.getElementById('infoVeiculoPdf');

    listaDiv.innerHTML = "";

    if (!modeloNome) {
        listaDiv.innerHTML = `<div class="empty-msg">Por favor, selecione uma marca e um modelo.</div>`;
        btnPdf.style.display = 'none';
        return;
    }

    if (kmAtual <= 0) {
        listaDiv.innerHTML = `<div class="empty-msg">Por favor, insira uma quilometragem válida.</div>`;
        btnPdf.style.display = 'none';
        return;
    }

    infoPdf.innerHTML = `<strong>Veículo:</strong> ${marcaNome} - ${modeloNome} <br><strong>Odômetro:</strong> ${kmAtual.toLocaleString('pt-BR')} km`;

    const pendencias = manutencaoPadrao.filter(item => {
        return (kmAtual % item.kmIntervalo === 0) || (kmAtual >= item.kmIntervalo);
    });

    if (pendencias.length === 0) {
        listaDiv.innerHTML = `<div class="empty-msg">Nenhuma manutenção periódica registrada para esta quilometragem.</div>`;
        btnPdf.style.display = 'none';
        return;
    }

    pendencias.forEach((task, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'task-item';
        itemDiv.id = `task-container-${index}`;

        itemDiv.innerHTML = `
            <input type="checkbox" id="check-${index}">
            <div class="task-content">
                <label for="check-${index}" class="task-title">${task.item}</label>
                <div class="task-desc">${task.desc}</div>
                <span class="task-tag">${task.cat} • A cada ${task.kmIntervalo.toLocaleString('pt-BR')} km</span>
            </div>
        `;
        listaDiv.appendChild(itemDiv);

        const checkbox = itemDiv.querySelector(`#check-${index}`);
        checkbox.addEventListener('change', () => toggleTask(index));
    });

    btnPdf.style.display = 'block';
}

function toggleTask(index) {
    const checkbox = document.getElementById(`check-${index}`);
    const container = document.getElementById(`task-container-${index}`);

    if (checkbox.checked) {
        container.classList.add('completed');
    } else {
        container.classList.remove('completed');
    }
}

// Abre a janela nativa do navegador para salvar como PDF/Imprimir
function gerarRelatorioPDF() {
    window.print();
}