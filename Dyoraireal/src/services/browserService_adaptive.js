const { chromium } = require('playwright');
const StealthService = require("./stealthService");
const CaptchaService = require("./captchaService");
const ProxyService = require("./proxyService");

class AdaptiveBrowserService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.stealthService = new StealthService();
    this.captchaService = new CaptchaService();
    this.proxyService = new ProxyService();
  }

  async initBrowser(options = {}) {
    try {
      const launchOptions = this.stealthService.getStealthLaunchOptions();
      const browserOptions = {
        ...launchOptions,
        headless: process.env.NODE_ENV === 'test' ? true : false, // Headless untuk testing
      };

      this.browser = await chromium.launch(browserOptions);

      const contextOptions = this.stealthService.getStealthContextOptions();
      this.context = await this.browser.newContext({
        ...contextOptions,
        ...options.contextOptions,
      });

      await this.context.addInitScript(this.stealthService.getStealthInitScript());

      this.page = await this.context.newPage();

      await this.page.setExtraHTTPHeaders({
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
      });

      return true;
    } catch (error) {
      console.error("Error initializing browser:", error);
      throw error;
    }
  }

  // Method untuk mendapatkan konten halaman saat ini
  async getPageContent() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const content = await this.page.content();
      return content;
    } catch (error) {
      console.error('Error getting page content:', error);
      return '';
    }
  }

  // Method untuk mendapatkan URL saat ini
  async getCurrentUrl() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      return this.page.url();
    } catch (error) {
      console.error('Error getting current URL:', error);
      return '';
    }
  }

  // Method untuk mendapatkan elemen yang terlihat
  async getVisibleElements() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const elements = await this.page.evaluate(() => {
        const visibleElements = [];
        const allElements = document.querySelectorAll('*');
        
        for (let i = 0; i < Math.min(allElements.length, 50); i++) {
          const element = allElements[i];
          const rect = element.getBoundingClientRect();
          
          if (rect.width > 0 && rect.height > 0 && 
              rect.top >= 0 && rect.left >= 0 && 
              rect.bottom <= window.innerHeight && 
              rect.right <= window.innerWidth) {
            
            visibleElements.push({
              tagName: element.tagName.toLowerCase(),
              id: element.id || '',
              className: element.className || '',
              text: element.textContent ? element.textContent.substring(0, 100) : '',
              type: element.type || '',
              name: element.name || '',
              placeholder: element.placeholder || '',
              href: element.href || '',
              src: element.src || ''
            });
          }
        }
        
        return visibleElements;
      });
      
      return elements;
    } catch (error) {
      console.error('Error getting visible elements:', error);
      return [];
    }
  }

  // Method untuk navigasi ke URL
  async navigateToUrl(url) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      await this.page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      
      // Deteksi captcha setelah navigasi
      const captchas = await this.captchaService.detectCaptcha(this.page);
      if (captchas.length > 0) {
        console.log(`Detected ${captchas.length} captcha(s) on page`);
      }

      await this.stealthService.simulateHumanBehavior(this.page);
      return true;
    } catch (error) {
      console.error('Error navigating to URL:', error);
      throw error;
    }
  }

  // Method untuk klik elemen
  async clickElement(selector) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      await this.stealthService.humanClick(this.page, selector);
      return true;
    } catch (error) {
      console.error('Error clicking element:', error);
      throw error;
    }
  }

  // Method untuk mengetik teks
  async typeText(selector, text) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      await this.stealthService.humanType(this.page, selector, text);
      return true;
    } catch (error) {
      console.error('Error typing text:', error);
      throw error;
    }
  }

  // Method untuk mengisi field form
  async fillField(fieldName, value) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const selectors = [
        `input[name="${fieldName}"]`,
        `input[id="${fieldName}"]`,
        `input[placeholder*="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `textarea[id="${fieldName}"]`,
        `select[name="${fieldName}"]`,
        `select[id="${fieldName}"]`,
      ];

      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });

          const element = this.page.locator(selector);
          const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

          if (tagName === "select") {
            await element.selectOption(value);
          } else {
            await this.stealthService.humanType(this.page, selector, value);
          }

          return true;
        } catch (e) {
          continue;
        }
      }
      
      throw new Error(`Field ${fieldName} not found`);
    } catch (error) {
      console.error('Error filling field:', error);
      throw error;
    }
  }

  // Method untuk scroll halaman
  async scrollPage(direction = 'down') {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      if (direction === 'down') {
        await this.stealthService.randomScroll(this.page);
      } else {
        await this.page.evaluate(() => {
          window.scrollBy(0, -window.innerHeight);
        });
      }
      return true;
    } catch (error) {
      console.error('Error scrolling page:', error);
      throw error;
    }
  }

  // Method untuk menunggu kondisi tertentu
  async waitForCondition(condition, timeout = 10000) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      switch (condition.toLowerCase()) {
        case "page load":
          await this.page.waitForLoadState("networkidle");
          break;
        case "element":
          await this.page.waitForSelector("body", { state: "visible" });
          break;
        default:
          try {
            await this.page.waitForSelector(condition, { timeout: timeout });
          } catch {
            await this.page.waitForTimeout(2000);
          }
      }
      return true;
    } catch (error) {
      console.error('Error waiting for condition:', error);
      return false;
    }
  }

  // Method untuk mengambil screenshot
  async takeScreenshot(filename = null) {
    if (!this.page) return null;

    try {
      const screenshotPath = filename || `data/screenshot_${Date.now()}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      return screenshotPath;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return null;
    }
  }

  // Method untuk menutup browser
  async closeBrowser() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  // Method untuk mendapatkan informasi form di halaman
  async getFormInfo() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const formInfo = await this.page.evaluate(() => {
        const forms = [];
        const formElements = document.querySelectorAll('form');
        
        formElements.forEach((form, index) => {
          const fields = [];
          const inputs = form.querySelectorAll('input, textarea, select');
          
          inputs.forEach(input => {
            fields.push({
              name: input.name || input.id || '',
              type: input.type || input.tagName.toLowerCase(),
              placeholder: input.placeholder || '',
              required: input.required || false,
              value: input.value || ''
            });
          });
          
          forms.push({
            index: index,
            action: form.action || '',
            method: form.method || 'get',
            fields: fields
          });
        });
        
        return forms;
      });
      
      return formInfo;
    } catch (error) {
      console.error('Error getting form info:', error);
      return [];
    }
  }

  // Method untuk mendapatkan semua link di halaman
  async getPageLinks() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const links = await this.page.evaluate(() => {
        const linkElements = document.querySelectorAll('a[href]');
        const links = [];
        
        linkElements.forEach(link => {
          links.push({
            text: link.textContent.trim(),
            href: link.href,
            title: link.title || ''
          });
        });
        
        return links.slice(0, 20); // Batasi 20 link pertama
      });
      
      return links;
    } catch (error) {
      console.error('Error getting page links:', error);
      return [];
    }
  }

  // Method untuk mendapatkan pesan error atau sukses di halaman
  async getPageMessages() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    try {
      const messages = await this.page.evaluate(() => {
        const messageSelectors = [
          '.error', '.alert-error', '.alert-danger',
          '.success', '.alert-success', '.alert-info',
          '.warning', '.alert-warning',
          '.message', '.notification', '.toast'
        ];
        
        const messages = [];
        
        messageSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            if (element.textContent.trim()) {
              messages.push({
                type: selector.includes('error') || selector.includes('danger') ? 'error' :
                      selector.includes('success') ? 'success' :
                      selector.includes('warning') ? 'warning' : 'info',
                text: element.textContent.trim(),
                selector: selector
              });
            }
          });
        });
        
        return messages;
      });
      
      return messages;
    } catch (error) {
      console.error('Error getting page messages:', error);
      return [];
    }
  }

  // Backward compatibility methods
  setCaptchaService(apiKey, service = "2captcha") {
    this.captchaService.setApiKey(apiKey, service);
  }

  setProxyService(proxies, enableRotation = true) {
    this.proxyService.clearProxies();
    this.proxyService.loadProxiesFromList(proxies);
    this.proxyService.enableRotation(enableRotation);
  }
}

module.exports = AdaptiveBrowserService;

