chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "getPageContent") {
    const pageText = document.body.innerText;
    sendResponse({ content: pageText.substring(0, 15000) }); 
  }
});