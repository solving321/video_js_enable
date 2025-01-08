const puppeteer = require("puppeteer");
require("dotenv").config();

const WAITING_TIME = (process.env.WAITING_TIME_MIN || 1) * 60000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrollToBottom(page) {
  const distance = 200; // should be less than or equal to window.innerHeight
  const delay = 50;
  const waitTime = 60 * 1000;
  const timeNow = Date.now() + waitTime;
  while (
    (await page.evaluate(
      () =>
        document.scrollingElement.scrollTop + window.innerHeight <
        document.scrollingElement.scrollHeight
    )) &&
    Date.now() <= timeNow
  ) {
    await page.evaluate((y) => {
      document.scrollingElement.scrollBy(0, y);
    }, distance);
    await sleep(delay);
  }
}

async function scrollToTopLeft(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

async function playYouTubeVideo(page, videoUrl) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    const url = request.url();

    const blockedResources = ["image", "stylesheet", "font", "media"];
    const blockedDomains = [
      "google-analytics.com",
      "doubleclick.net",
      "googlesyndication.com",
      "adservice.google.com",
    ];

    if (
      blockedResources.includes(resourceType) ||
      blockedDomains.some((domain) => url.includes(domain))
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });

  await page.goto(videoUrl, { waitUntil: "networkidle2" });

  // Click the play button if necessary
  await page.waitForSelector(
    "#movie_player > div.ytp-cued-thumbnail-overlay > button",
    { visible: true }
  );
  await page.evaluate(() => {
    const button = document.querySelector(
      "#movie_player > div.ytp-cued-thumbnail-overlay > button"
    );
    if (button) button.click();
  });

  await sleep(2000);
  await scrollToBottom(page);
  await sleep(4000); // scolling bottom for 4 seconds, to remove the lazy loading issues.
  await scrollToTopLeft(page);

  await sleep(WAITING_TIME);
  await page.close();
}

async function focusPagesSequentially(pages) {
  for (let i = 0; i < pages.length; i++) {
    console.log(`Focusing on page ${i + 1}`);
    await pages[i].bringToFront();
    await sleep(2000); // Simulate user focus
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Do not use headless mode to mimic a real user
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const videoUrl = process.env.VIDEO_URL;
  const pageCount = parseInt(process.env.PAGE_COUNT, 10) || 5;
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    const page = await browser.newPage();
    pages.push(page);
  }

  const playbackTasks = pages.map((page) => playYouTubeVideo(page, videoUrl));
  await focusPagesSequentially(pages);
  await Promise.all(playbackTasks);

  await browser.close();
})();
