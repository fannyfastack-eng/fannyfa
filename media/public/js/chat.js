/* =========================================================
   chat.js — logika utama chat UI FannyFa AI Terminal
========================================================= */

(function () {

  const deviceId = window.SettingAI.getDeviceId();
  let sessionId = localStorage.getItem("ff_ai_active_session") || null;
  let pendingFiles = [];
  let historyCache = [];

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const el = {
    welcome: document.getElementById("welcomeSection"),
    messages: document.getElementById("messages"),
    input: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    attachBtn: document.getElementById("attachBtn"),
    attachMenu: document.getElementById("attachMenu"),
    fileInput: document.getElementById("fileInput"),
    attachPreview: document.getElementById("attachPreview"),
    modelBtn: document.getElementById("modelBtn"),
    modelBtnLabel: document.getElementById("modelBtnLabel"),
    modelDropdown: document.getElementById("modelDropdown"),
    btnNewChat: document.getElementById("btnNewChat"),
    btnHistory: document.getElementById("btnHistory"),
    historyPanel: document.getElementById("historyPanel"),
    closeHistory: document.getElementById("closeHistory"),
    overlayDim: document.getElementById("overlayDim"),
    sessionList: document.getElementById("sessionList"),
    btnDeleteAll: document.getElementById("btnDeleteAll"),
    greetingText: document.getElementById("greetingText"),
    greetingSub: document.getElementById("greetingSub"),
    fxCanvas: document.getElementById("fxCanvas")
  };

  /* ================= GREETING ================= */

  function setGreeting() {
    const h = new Date().getHours();
    let text = "Selamat Malam";
    if (h >= 4 && h < 11) text = "Selamat Pagi";
    else if (h >= 11 && h < 15) text = "Selamat Siang";
    else if (h >= 15 && h < 18) text = "Selamat Sore";
    el.greetingText.textContent = text + ", Fari";
    el.greetingSub.textContent = "AI Terminal siap membantu — pilih model, mulai ngobrol.";
  }
  setGreeting();

  /* ================= CLICK PARTICLE FX (border-radius:50%) ================= */

  document.addEventListener("click", function (e) {
    const target = e.target.closest(".fx-btn");
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 6;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const dist = 14 + Math.random() * 12;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      const dot = document.createElement("div");
      dot.className = "burst-dot";
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      dot.style.setProperty("--dx", dx + "px");
      dot.style.setProperty("--dy", dy + "px");
      document.body.appendChild(dot);

      setTimeout(() => dot.remove(), 600);
    }
  });

  /* ================= MODEL DROPDOWN ================= */

  function renderModelDropdown() {
    const selected = window.SettingAI.getSelectedModel();
    el.modelDropdown.innerHTML = "";

    window.SettingAI.PROVIDERS.forEach((provider) => {
      const label = document.createElement("div");
      label.className = "model-group-label";
      label.textContent = provider;
      el.modelDropdown.appendChild(label);

      window.SettingAI.MODELS[provider].forEach((m) => {
        const btn = document.createElement("button");
        btn.className = "model-option fx-btn";
        if (provider === selected.provider && m.id === selected.model) {
          btn.classList.add("selected");
        }
        btn.innerHTML = `<i class="bi bi-dot"></i> ${m.label}`;
        btn.addEventListener("click", () => {
          window.SettingAI.setSelectedModel(provider, m.id);
          updateModelButtonLabel();
          renderModelDropdown();
          closeModelDropdown();
        });
        el.modelDropdown.appendChild(btn);
      });
    });
  }

  function updateModelButtonLabel() {
    const selected = window.SettingAI.getSelectedModel();
    const list = window.SettingAI.MODELS[selected.provider] || [];
    const found = list.find((m) => m.id === selected.model);
    el.modelBtnLabel.textContent = found ? found.label : selected.provider;
  }

  function toggleModelDropdown() {
    el.modelDropdown.classList.toggle("active");
    el.modelBtn.classList.toggle("open");
  }

  function closeModelDropdown() {
    el.modelDropdown.classList.remove("active");
    el.modelBtn.classList.remove("open");
  }

  el.modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    renderModelDropdown();
    toggleModelDropdown();
    closeAttachMenu();
  });

  document.addEventListener("click", (e) => {
    if (!el.modelDropdown.contains(e.target) && !el.modelBtn.contains(e.target)) {
      closeModelDropdown();
    }
  });

  updateModelButtonLabel();

  /* ================= ATTACH MENU ================= */

  function closeAttachMenu() {
    el.attachMenu.classList.remove("active");
  }

  el.attachBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    el.attachMenu.classList.toggle("active");
    closeModelDropdown();
  });

  document.addEventListener("click", (e) => {
    if (!el.attachMenu.contains(e.target) && !el.attachBtn.contains(e.target)) {
      closeAttachMenu();
    }
  });

  el.attachMenu.querySelectorAll(".attach-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      el.fileInput.accept = opt.dataset.accept || "*";
      el.fileInput.click();
      closeAttachMenu();
    });
  });

  const MAX_FILE_MB = 8;

  el.fileInput.addEventListener("change", () => {
    Array.from(el.fileInput.files).forEach((file) => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${file.name}" kelewat gede (maks ${MAX_FILE_MB}MB). Lewatin file ini.`);
        return;
      }
      pendingFiles.push(file);
    });
    renderAttachPreview();
    el.fileInput.value = "";
  });

  function renderAttachPreview() {
    el.attachPreview.innerHTML = "";
    pendingFiles.forEach((file, idx) => {
      const chip = document.createElement("div");
      chip.className = "attach-chip";
      const icon = file.type.startsWith("image/") ? "bi-image" : "bi-file-earmark";
      chip.innerHTML = `<i class="bi ${icon}"></i> <span>${file.name}</span>`;
      const rm = document.createElement("button");
      rm.innerHTML = '<i class="bi bi-x"></i>';
      rm.addEventListener("click", () => {
        pendingFiles.splice(idx, 1);
        renderAttachPreview();
      });
      chip.appendChild(rm);
      el.attachPreview.appendChild(chip);
    });
  }

  /* ================= TEXTAREA AUTO-RESIZE ================= */

  el.input.addEventListener("input", () => {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 140) + "px";
  });

  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.sendBtn.addEventListener("click", sendMessage);

  /* ================= CODE BLOCK RENDERING ================= */

  function renderContentWithCode(container, text) {
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let blockCount = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        appendTextNode(container, text.slice(lastIndex, match.index));
      }

      const lang = (match[1] || "plaintext").toLowerCase();
      const code = match[2];
      blockCount++;
      appendCodeBlock(container, lang, code, blockCount);

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      appendTextNode(container, text.slice(lastIndex));
    }
  }

  function appendTextNode(container, text) {
    if (!text.trim()) return;
    const p = document.createElement("div");
    p.textContent = text.trim();
    p.style.whiteSpace = "pre-wrap";
    container.appendChild(p);
  }

  const PREVIEWABLE = ["html", "svg", "xml"];

  function appendCodeBlock(container, lang, code, idx) {
    const block = document.createElement("div");
    block.className = "code-block";

    const head = document.createElement("div");
    head.className = "code-block-head";

    const langLabel = document.createElement("span");
    langLabel.textContent = lang;
    head.appendChild(langLabel);

    const actions = document.createElement("div");
    actions.className = "code-block-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "fx-btn";
    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Salin';
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.innerHTML = '<i class="bi bi-check2"></i> Disalin';
        setTimeout(() => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Salin'), 1400);
      });
    });
    actions.appendChild(copyBtn);

    let iframe = null;

    if (PREVIEWABLE.includes(lang)) {
      const previewBtn = document.createElement("button");
      previewBtn.className = "fx-btn";
      previewBtn.innerHTML = '<i class="bi bi-eye"></i> Preview';
      previewBtn.addEventListener("click", () => {
        iframe.classList.toggle("active");
        const showing = iframe.classList.contains("active");
        previewBtn.innerHTML = showing
          ? '<i class="bi bi-eye-slash"></i> Sembunyikan'
          : '<i class="bi bi-eye"></i> Preview';
        if (showing) {
          iframe.srcdoc = code;
        }
      });
      actions.appendChild(previewBtn);
    }

    head.appendChild(actions);
    block.appendChild(head);

    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.className = "language-" + lang;
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    block.appendChild(pre);

    if (PREVIEWABLE.includes(lang)) {
      iframe = document.createElement("iframe");
      iframe.className = "code-preview-frame";
      iframe.setAttribute("sandbox", "allow-scripts");
      block.appendChild(iframe);
    }

    container.appendChild(block);

    if (window.hljs) {
      window.hljs.highlightElement(codeEl);
    }
  }

  /* ================= MESSAGE RENDER ================= */

  function showChatMode() {
    el.welcome.style.display = "none";
    el.messages.classList.add("active");
  }

  function addMessageToDOM(msg) {
    const row = document.createElement("div");
    row.className = "msg-row " + (msg.role === "user" ? "user" : "ai");
    row.dataset.msgId = msg.id;

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    meta.innerHTML = `<i class="bi ${msg.role === "user" ? "bi-person" : "bi-cpu"}"></i> ${msg.role === "user" ? "Kamu" : (msg.model || "AI")}`;
    row.appendChild(meta);

    if (msg.attachments && msg.attachments.length) {
      const attWrap = document.createElement("div");
      attWrap.className = "msg-attachments";
      msg.attachments.forEach((a) => {
        const chip = document.createElement("span");
        chip.className = "att-chip";
        chip.innerHTML = `<i class="bi bi-paperclip"></i> ${a.name}`;
        attWrap.appendChild(chip);
      });
      row.appendChild(attWrap);
    }

    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    renderContentWithCode(bubble, msg.content || "");
    row.appendChild(bubble);

    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-action-btn fx-btn";
    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
    copyBtn.title = "Salin pesan";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(msg.content || "");
      copyBtn.innerHTML = '<i class="bi bi-check2"></i>';
      setTimeout(() => (copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>'), 1200);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "msg-action-btn fx-btn";
    delBtn.innerHTML = '<i class="bi bi-trash3"></i>';
    delBtn.title = "Hapus pesan";
    delBtn.addEventListener("click", () => deleteMessage(msg.id, row));

    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    el.messages.appendChild(row);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function addTypingIndicator() {
    const row = document.createElement("div");
    row.className = "msg-row ai";
    row.id = "typingRow";
    row.innerHTML = `
      <div class="msg-meta"><i class="bi bi-cpu"></i> AI</div>
      <div class="typing-row"><span></span><span></span><span></span></div>
    `;
    el.messages.appendChild(row);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function removeTypingIndicator() {
    const row = document.getElementById("typingRow");
    if (row) row.remove();
  }

  /* ================= SEND MESSAGE ================= */

  async function sendMessage() {
    const text = el.input.value.trim();
    if (!text && pendingFiles.length === 0) return;

    showChatMode();

    const selected = window.SettingAI.getSelectedModel();

    const userMsg = {
      id: "m_" + Date.now(),
      role: "user",
      content: text,
      attachments: pendingFiles.map((f) => ({ name: f.name, type: f.type }))
    };
    addMessageToDOM(userMsg);

    el.input.value = "";
    el.input.style.height = "auto";
    const filesToSend = pendingFiles.slice();
    pendingFiles = [];
    renderAttachPreview();

    el.sendBtn.classList.add("sending");
    addTypingIndicator();

    try {
      const attachmentsPayload = [];
      for (const file of filesToSend) {
        const dataBase64 = await fileToBase64(file);
        attachmentsPayload.push({
          name: file.name,
          type: file.type || "application/octet-stream",
          dataBase64
        });
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          sessionId: sessionId || "",
          provider: selected.provider,
          model: selected.model,
          message: text,
          systemPrompt: window.SettingAI.getSystemPrompt(),
          attachments: attachmentsPayload
        })
      });

      const data = await res.json();

      removeTypingIndicator();

      if (!res.ok) {
        addMessageToDOM({
          id: "m_" + Date.now(),
          role: "ai",
          model: "system",
          content: "```plaintext\n" + (data.error || "Terjadi kesalahan saat menghubungi model.") + "\n```"
        });
        return;
      }

      sessionId = data.sessionId;
      localStorage.setItem("ff_ai_active_session", sessionId);

      addMessageToDOM({
        id: data.messageId || "m_" + Date.now(),
        role: "ai",
        model: selected.model,
        content: data.reply
      });

    } catch (err) {
      removeTypingIndicator();
      addMessageToDOM({
        id: "m_" + Date.now(),
        role: "ai",
        model: "system",
        content: "```plaintext\nGagal terhubung ke server backend.\n```"
      });
    } finally {
      el.sendBtn.classList.remove("sending");
    }
  }

  /* ================= DELETE MESSAGE / ALL ================= */

  async function deleteMessage(msgId, rowEl) {
    rowEl.style.transition = "opacity .2s ease, transform .2s ease";
    rowEl.style.opacity = "0";
    rowEl.style.transform = "translateY(-6px)";
    setTimeout(() => rowEl.remove(), 200);

    if (!sessionId) return;
    try {
      await fetch(`/api/session/${sessionId}/message/${msgId}`, { method: "DELETE" });
    } catch (e) {}
  }

  el.btnDeleteAll.addEventListener("click", async () => {
    if (!sessionId) {
      el.messages.innerHTML = "";
      el.welcome.style.display = "flex";
      el.messages.classList.remove("active");
      return;
    }
    try {
      await fetch(`/api/session/${sessionId}`, { method: "DELETE" });
    } catch (e) {}
    el.messages.innerHTML = "";
    el.welcome.style.display = "flex";
    el.messages.classList.remove("active");
    closeHistoryPanel();
    loadSessionList();
  });

  /* ================= NEW CHAT ================= */

  el.btnNewChat.addEventListener("click", () => {
    sessionId = null;
    localStorage.removeItem("ff_ai_active_session");
    el.messages.innerHTML = "";
    el.messages.classList.remove("active");
    el.welcome.style.display = "flex";
    setGreeting();
  });

  /* ================= HISTORY PANEL ================= */

  function openHistoryPanel() {
    el.historyPanel.classList.add("active");
    el.overlayDim.classList.add("active");
    loadSessionList();
  }

  function closeHistoryPanel() {
    el.historyPanel.classList.remove("active");
    el.overlayDim.classList.remove("active");
  }

  el.btnHistory.addEventListener("click", openHistoryPanel);
  el.closeHistory.addEventListener("click", closeHistoryPanel);
  el.overlayDim.addEventListener("click", closeHistoryPanel);

  async function loadSessionList() {
    el.sessionList.innerHTML = '<div class="session-empty">Memuat...</div>';
    try {
      const res = await fetch(`/api/sessions/${deviceId}`);
      const data = await res.json();
      historyCache = data.sessions || [];

      if (historyCache.length === 0) {
        el.sessionList.innerHTML = '<div class="session-empty">Belum ada riwayat sesi</div>';
        return;
      }

      el.sessionList.innerHTML = "";
      historyCache.forEach((s, i) => {
        const item = document.createElement("div");
        item.className = "session-item" + (s.id === sessionId ? " active-session" : "");
        item.style.animationDelay = (i * 0.03) + "s";
        item.innerHTML = `
          <span class="s-title"><i class="bi bi-chat-left-text"></i> ${s.title || "Percakapan"}</span>
          <button class="s-del fx-btn" aria-label="Hapus sesi"><i class="bi bi-trash3"></i></button>
        `;
        item.addEventListener("click", (e) => {
          if (e.target.closest(".s-del")) return;
          loadSessionMessages(s.id);
          closeHistoryPanel();
        });
        item.querySelector(".s-del").addEventListener("click", async (e) => {
          e.stopPropagation();
          await fetch(`/api/session/${s.id}`, { method: "DELETE" });
          if (s.id === sessionId) {
            sessionId = null;
            localStorage.removeItem("ff_ai_active_session");
            el.messages.innerHTML = "";
            el.messages.classList.remove("active");
            el.welcome.style.display = "flex";
          }
          loadSessionList();
        });
        el.sessionList.appendChild(item);
      });
    } catch (e) {
      el.sessionList.innerHTML = '<div class="session-empty">Gagal memuat riwayat</div>';
    }
  }

  async function loadSessionMessages(id) {
    try {
      const res = await fetch(`/api/session/${id}`);
      const data = await res.json();
      sessionId = id;
      localStorage.setItem("ff_ai_active_session", id);

      el.messages.innerHTML = "";
      if (data.messages && data.messages.length) {
        showChatMode();
        data.messages.forEach(addMessageToDOM);
      } else {
        el.welcome.style.display = "flex";
        el.messages.classList.remove("active");
      }
    } catch (e) {}
  }

  /* ================= INIT ================= */

  if (sessionId) {
    loadSessionMessages(sessionId);
  }

})();
