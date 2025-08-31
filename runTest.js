require('dotenv').config(); 

const puppeteer = require('puppeteer');
const fs = require('fs');
const { spawn } = require('child_process');

(async () => {
  const baseUrl = process.env.BASE_URL;
  const userAgent = process.env.USER_AGENT;

  if (!baseUrl) {
    console.error('Ошибка: BASE_URL не указан в .env');
    process.exit(1);
  }

  console.log(`Открываем страницу: ${baseUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setUserAgent(userAgent);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
  } catch (error) {
    console.error('Ошибка при загрузке страницы:', error);
    await browser.close();
    process.exit(1);
  }

  console.log('Ожидаем появления cookies...');

  const maxWaitTime = 180000; 
  const checkInterval = 1000;
  let sessionId = null;

  for (let elapsed = 0; elapsed < maxWaitTime; elapsed += checkInterval) {
    const cookies = await page.cookies();
    const sessionIdCookie = cookies.find((cookie) => cookie.name === 'sessionId');
    if (sessionIdCookie) {
      sessionId = sessionIdCookie.value;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  await browser.close();

  if (!sessionId) {
    console.error('❌ sessionId не найден. Превышено время ожидания.');
    process.exit(1);
  }

  console.log(`✅ Получен sessionId: ${sessionId}`);
  fs.writeFileSync('sessionId.txt', sessionId, 'utf8');
  console.log('💾 sessionId сохранён в sessionId.txt');

  console.log('🚀 Запускаем нагрузочное тестирование с sessionId...');

  // Создаем поток для записи логов в файл
  const logFile = fs.createWriteStream('logs.txt', { flags: 'a' });

  // Запускаем k6
  const k6 = spawn('k6', ['run', 'loadTest.js'], {
    env: { ...process.env, SESSION_ID: sessionId }
  });

  k6.stdout.on('data', (data) => {
    process.stdout.write(data);
    logFile.write(data);
  });

  k6.stderr.on('data', (data) => {
    process.stderr.write(data);
    logFile.write(data);
  });

  k6.on('close', (code) => {
    console.log(`k6 завершился с кодом: ${code}`);
    logFile.end();
  });
})();
