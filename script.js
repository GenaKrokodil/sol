// БЛОК 1: Управление вкладками и модальными окнами
// Отвечает за переключение видимости основных разделов (Мониторинг, Стратегия и т.д.) при клике на вкладки.
// Также управляет открытием и закрытием модального окна настроек, включая закрытие по клику вне окна или по клавише Esc.
function switchTab(name) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('pane-' + name).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => {
        if (t.getAttribute('onclick').includes(name)) t.classList.add('active');
    });
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
}

document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { 
        if (e.target === o) o.classList.remove('active'); 
    });
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

// БЛОК 2: Управление состоянием системы (Запуск / Остановка)
// Обрабатывает нажатие кнопки START/STOP SYSTEM, отправляя запросы на локальный сервер (порт 8080).
// Переключает визуальный статус (OFFLINE/LIVE), меняет текст кнопки и запускает/останавливает интервал опроса данных.
let isRunning = false;
let dataInterval = null;

async function toggleSystem() {
    const btn = document.getElementById('startButton');
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    
    if (!isRunning) {
        try {
            // Относительный путь вместо http://localhost:8080
            const res = await fetch('/api/control?action=start');
            const data = await res.json();
            if (data.status.includes("Запущено") || data.status.includes("Уже")) {
                isRunning = true;
                btn.textContent = 'STOP SYSTEM';
                btn.classList.add('running');
                dot.classList.add('active');
                txt.textContent = 'LIVE';
                fetchData(); 
                dataInterval = setInterval(fetchData, 1000); 
            }
        } catch (e) { 
            console.error("Ошибка запуска системы:", e); 
        }
    } else {
        try {
            // Относительный путь вместо http://localhost:8080
            await fetch('/api/control?action=stop');
            isRunning = false;
            btn.textContent = 'START SYSTEM';
            btn.classList.remove('running');
            dot.classList.remove('active');
            txt.textContent = 'OFFLINE';
            clearInterval(dataInterval);
        } catch (e) { 
            console.error("Ошибка остановки системы:", e); 
        }
    }
}

// БЛОК 3: Получение данных и динамический рендеринг таблицы
// Эта функция запрашивает актуальные данные свечей с сервера и обновляет DOM таблицы.
// Использует относительный путь для корректной работы в развернутом окружении.
async function fetchData() {
    try {
        // Относительный путь вместо http://localhost:8080
        const res = await fetch('/api/candles');
        const data = await res.json();
        updateTable(data);
    } catch (e) {
        console.error("Ошибка получения данных:", e);
    }
}

function updateTable(data) {
    const tbody = document.getElementById('candleTableBody');
    if (!data.current && data.history.length === 0) return;
    
    let html = '';
    
    // Рендеринг текущей (незакрытой) свечи с неоновой подсветкой
    if (data.current) {
        const ch = ((data.current.close - data.current.open) / data.current.open * 100).toFixed(2);
        const cls = data.current.close >= data.current.open ? 'price-up' : 'price-down';
        const sym = data.current.close >= data.current.open ? '▲' : '▼';
        html += `<tr class="current-candle">
            <td>${data.current.timestamp.split(' ')[1] || data.current.timestamp}</td>
            <td>${data.current.open.toFixed(2)}</td>
            <td>${data.current.high.toFixed(2)}</td>
            <td>${data.current.low.toFixed(2)}</td>
            <td class="${cls}">${data.current.close.toFixed(2)}</td>
            <td>${data.current.volume}</td>
            <td class="${cls}">${sym} ${ch}%</td>
        </tr>`;
    }
    
    // Рендеринг истории закрытых свечей (добавляются ниже текущей, таблица растёт вниз)
    data.history.forEach(c => {
        const ch = ((c.close - c.open) / c.open * 100).toFixed(2);
        const cls = c.close >= c.open ? 'price-up' : 'price-down';
        const sym = c.close >= c.open ? '▲' : '▼';
        html += `<tr>
            <td>${c.timestamp.split(' ')[1] || c.timestamp}</td>
            <td>${c.open.toFixed(2)}</td>
            <td>${c.high.toFixed(2)}</td>
            <td>${c.low.toFixed(2)}</td>
            <td class="${cls}">${c.close.toFixed(2)}</td>
            <td>${c.volume}</td>
            <td class="${cls}">${sym} ${ch}%</td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

// БЛОК 4: Управление модальным окном диапазона дат
// Отвечает за открытие окна при нажатии START SYSTEM и отправку введенных дат на сервер.
// Также обновляет интерфейс, показывая, что идет загрузка данных или они уже отображены.
let dateModal = document.getElementById('dateRangeModal');

function openDateModal() {
    dateModal.classList.add('active');
}

function closeDateModal() {
    dateModal.classList.remove('active');
}

async function startBacktest() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert("Пожалуйста, выберите обе даты!");
        return;
    }

    closeDateModal();
    
    // Меняем статус на "Загрузка..."
    const btn = document.getElementById('startButton');
    const txt = document.getElementById('statusText');
    btn.textContent = 'LOADING...';
    txt.textContent = 'FETCHING';

    try {
        // Запрос к серверу на получение истории
        const res = await fetch(`/api/history?start=${startDate}&end=${endDate}`);
        const data = await res.json();
        
        updateTable({ current: null, history: data });
        
        btn.textContent = 'TEST STRATEGY'; // Теперь кнопка меняет назначение
        txt.textContent = 'READY';
        document.getElementById('statusDot').classList.add('active');
    } catch (e) {
        console.error("Ошибка загрузки истории:", e);
        btn.textContent = 'START SYSTEM';
        txt.textContent = 'ERROR';
    }
}

