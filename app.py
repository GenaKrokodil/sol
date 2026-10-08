# ============================================================================
# БЛОК 1: ИМПОРТ БИБЛИОТЕК И НАСТРОЙКИ
# ============================================================================
# Импортируем FastAPI и необходимые модули для раздачи статики и работы с файлами.
# Добавляем httpx для асинхронных запросов к Bybit и datetime для обработки дат.
import os
from datetime import datetime
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

for folder in ["static", "static/windows", "strategies", "configs", "market_data", "results"]:
    if not os.path.exists(folder): os.makedirs(folder)

# ============================================================================
# БЛОК 2: ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ И CORS
# ============================================================================
# Создаем экземпляр приложения и настраиваем политику CORS для разрешения запросов 
# с браузера к нашему локальному серверу без блокировок безопасности.
app = FastAPI(title="SOL/USDT Trading Lab")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ============================================================================
# БЛОК 3: РАЗДАЧА СТАТИЧЕСКИХ ФАЙЛОВ
# ============================================================================
# Настраиваем маршруты для раздачи CSS, JS и других ресурсов из папки static.
# Это позволяет браузеру корректно подгружать дизайн и логику интерфейса.
app.mount("/static", StaticFiles(directory="static"), name="static")

# ============================================================================
# БЛОК 4: РОУТИНГ ОКОН И API ДЛЯ ИСТОРИИ
# ============================================================================
# Определяем эндпоинты для вкладок и добавляем специальный маршрут /api/history.
# Этот маршрут принимает даты, идет на Bybit, скачивает свечи и отдает их в таблицу.
@app.get("/")
async def read_root():
    return FileResponse("index.html")

@app.get("/monitoring")
async def get_monitoring():
    return FileResponse("index.html")

@app.get("/strategy")
async def get_strategy():
    return FileResponse("index.html")

@app.get("/api/history")
async def get_history(start: str, end: str):
    SYMBOL = "SOLUSDT"
    CATEGORY = "linear"
    candles = []
    cursor = ""
    
    # Преобразуем строковые даты из HTML в метки времени (timestamp)
    try:
        start_ts = int(datetime.strptime(start, "%Y-%m-%dT%H:%M").timestamp() * 1000)
        end_ts = int(datetime.strptime(end, "%Y-%m-%dT%H:%M").timestamp() * 1000)
    except ValueError:
        return {"error": "Неверный формат даты"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            # Запрос к Bybit Kline API (исторические свечи)
            url = f"https://api.bybit.com/v5/market/kline?category={CATEGORY}&symbol={SYMBOL}&interval=1&start={start_ts}&end={end_ts}&limit=1000"
            if cursor: url += f"&cursor={cursor}"
            
            response = await client.get(url)
            data = response.json()
            
            if data['retCode'] != 0: break
            
            list_data = data['result']['list']
            if not list_data: break
            
            # Преобразуем данные в удобный для таблицы формат
            for item in list_data:
                candles.append({
                    "timestamp": datetime.fromtimestamp(int(item[0])/1000).strftime('%Y-%m-%d %H:%M:%S'),
                    "open": float(item[1]), "high": float(item[2]),
                    "low": float(item[3]), "close": float(item[4]), "volume": float(item[5])
                })
            
            cursor = data['result'].get('nextPageCursor')
            if not cursor: break
            
            # Сдвигаем время начала, чтобы не скачивать одно и то же
            start_ts = int(list_data[-1][0]) + 60000 

    candles.sort(key=lambda x: x['timestamp']) # Сортируем от старых к новым
    return candles

# ============================================================================
# БЛОК 5: ЗАПУСК СЕРВЕРА
# ============================================================================
# Точка входа для запуска Uvicorn сервера на порту 8080.
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print(" ЗАПУСК ТОРГОВОЙ ЛАБОРАТОРИИ SOL/USDT")
    print(" ОТКРОЙТЕ: http://127.0.0.1:8080")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")