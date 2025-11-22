document.addEventListener('DOMContentLoaded', () => {
  const historyDiv = document.getElementById('chat-history');
  const inputField = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const modelSelect = document.getElementById('model-select');

  if (typeof GEMINI_API_KEY === 'undefined' || GEMINI_API_KEY.includes("貼り付けて")) {
    appendMessage("Error", "設定エラー: config.js が正しく読み込まれていません。<br>APIキーを設定してください。");
  }

  let pageContext = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || tabs.length === 0) return;
    const tabId = tabs[0].id;
    
    if (tabs[0].url.startsWith("chrome://") || tabs[0].url.startsWith("edge://")) {
      appendMessage("System", "このページでは使用できません。");
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) return;
      chrome.tabs.sendMessage(tabId, { action: "getPageContent" }, (response) => {
        if (!chrome.runtime.lastError && response && response.content) {
          pageContext = response.content;
          appendMessage("System", "ページを読み込みました。");
        }
      });
    });
  });

  sendBtn.addEventListener('click', async () => {
    const userMessage = inputField.value;
    const selectedModel = modelSelect.value;
    const apiKey = (typeof GEMINI_API_KEY !== 'undefined') ? GEMINI_API_KEY : "";

    if (!userMessage) return;
    if (!apiKey || apiKey.length < 10) {
      appendMessage("Error", "APIキーが設定されていません。");
      return;
    }

    appendMessage("You", userMessage);
    inputField.value = "";
    const loadingId = appendMessage("System", "考え中...");

    try {
      const response = await callGeminiAPI(apiKey, userMessage, pageContext, selectedModel);
      removeMessage(loadingId);
      appendMessage("Gemini", response);
    } catch (error) {
      removeMessage(loadingId);
      appendMessage("Error", `エラーが発生しました:\n${error.message}`);
    }
  });

  function appendMessage(sender, text) {
    const div = document.createElement('div');
    const msgId = "msg-" + Date.now() + Math.random();
    div.id = msgId;
    div.className = `message ${sender === 'You' ? 'user' : 'ai'}`;
    
    if (sender === 'System' || sender === 'Error') {
       div.innerHTML = text;
    } else {
       let displayText = text;
       if (sender === 'Gemini') {
         displayText = parseMarkdown(text);
       } else {
         displayText = text.replace(/\n/g, '<br>');
       }
       div.innerHTML = `<strong>${sender}:</strong><br>${displayText}`;
    }

    historyDiv.appendChild(div);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    return msgId;
  }

  function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // ★追加: 簡易Markdownパーサー（ここが表示を綺麗にする処理です）
  function parseMarkdown(text) {
    let html = text;

    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#eee;padding:5px;border-radius:4px;"><code>$1</code></pre>');
    
    html = html.replace(/`([^`]+)`/g, '<code style="background:#eee;padding:2px 4px;border-radius:3px;">$1</code>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    

    html = html.replace(/^[\*\-] (.*)$/gm, '・$1');

    html = html.replace(/^### (.*)$/gm, '<strong>$1</strong>');
    html = html.replace(/^## (.*)$/gm, '<h4 style="margin:5px 0;">$1</h4>');

    html = html.replace(/\n/g, '<br>');

    return html;
  }

  async function callGeminiAPI(key, prompt, context, modelType) {
    let modelName = 'gemini-2.5-flash'; 
    if (modelType === 'pro') {
      modelName = 'gemini-2.5-pro'; 
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: `以下のWebページの内容に基づいて答えてください。\n\n[ページ内容]: ${context}\n\n[ユーザーの質問]: ${prompt}` }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      const errorMsg = `Code: ${data.error.code}\nMessage: ${data.error.message}`;
      throw new Error(errorMsg);
    }
    
    if (!data.candidates || data.candidates.length === 0) {
       throw new Error("応答が空でした。");
    }

    return data.candidates[0].content.parts[0].text;
  }
});