// Test script to check if Puppeteer can launch
const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('Testing Puppeteer...');
  
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    console.log('✅ Browser launched successfully!');
    
    const page = await browser.newPage();
    await page.setContent('<h1>Test PDF</h1>');
    
    const pdf = await page.pdf({ format: 'A4' });
    console.log('✅ PDF generated successfully! Size:', pdf.length, 'bytes');
    
    await browser.close();
    console.log('✅ Browser closed');
    console.log('\n✅ Puppeteer is working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Puppeteer test failed:');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    
    if (error.message.includes('Failed to launch')) {
      console.error('\n🔧 This might be due to missing Chrome/Chromium dependencies.');
      console.error('On Ubuntu/Debian, try installing:');
      console.error('  sudo apt-get install -y chromium-browser');
      console.error('Or:');
      console.error('  sudo apt-get install -y libnss3 libatk-bridge2.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpangocairo-1.0-0 libcairo2 libasound2');
    }
    
    process.exit(1);
  }
}

testPuppeteer();
