/* =========================================================
   settingai.js
   Mengatur: modal settings, penyimpanan API key (via backend),
   daftar model per provider, dan model yang lagi aktif dipakai.
   File ini expose window.SettingAI supaya dipakai chat.js
========================================================= */

(function () {

  const PROVIDERS = ["gemini", "groq", "openai", "deepseek", "qwen"];

  const MODELS = {
    gemini: [
      { id: "gemini-2.5-flash", label: "Gemini · 2.6 flash" },
      { id: "gemini-1.5-flash", label: "Gemini · 1.5 flash" }
    ],
    groq: [
{ id: "openai/gpt-oss-20b", label: "Groq · GPT-OSS 20B" },
{ id: "openai/gpt-oss-120b", label: "Groq · GPT-OSS 120B" },
{ id: "qwen/qwen3.6-27b", label: "Groq · Qwen3.6 27B" },
    ],
    openai: [
      { id: "gpt-4o-mini", label: "ChatGPT · GPT-4o mini" },
      { id: "gpt-4o", label: "ChatGPT · GPT-4o" }
    ],
    deepseek: [
      { id: "deepseek-chat", label: "DeepSeek · Chat" },
      { id: "deepseek-reasoner", label: "DeepSeek · Reasoner" }
    ],
    qwen: [
  { id: "z-ai/glm-5.2:free", label: "Qwen · 3.7 Flash" },
  { id: "z-ai/glm-5.2:free", label: "Qwen · 3.8 27B" }
]
  };

  const LS_MODEL_KEY = "ff_ai_selected_model";
  const LS_PROVIDER_KEY = "ff_ai_selected_provider";

  function getDeviceId() {
    let id = localStorage.getItem("ff_ai_device_id");
    if (!id) {
      id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("ff_ai_device_id", id);
    }
    return id;
  }

  function getSelectedModel() {
    return {
      provider: localStorage.getItem(LS_PROVIDER_KEY) || "gemini",
      model: localStorage.getItem(LS_MODEL_KEY) || MODELS.gemini[0].id
    };
  }

  function setSelectedModel(provider, model) {
    localStorage.setItem(LS_PROVIDER_KEY, provider);
    localStorage.setItem(LS_MODEL_KEY, model);
    window.dispatchEvent(new CustomEvent("ff:model-changed", { detail: { provider, model } }));
  }

  async function fetchKeyStatus() {
    try {
      const res = await fetch("/api/settings/keys");
      if (!res.ok) throw new Error("fail");
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  async function saveKeys(keysObj) {
    const res = await fetch("/api/settings/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: keysObj })
    });
    if (!res.ok) throw new Error("Gagal menyimpan");
    return await res.json();
  }

  /* ================= MODAL WIRING ================= */

  function initSettingsModal() {
    const modal = document.getElementById("settingsModal");
    const btnOpen = document.getElementById("btnSettings");
    const btnClose = document.getElementById("closeSettings");
    const btnSave = document.getElementById("btnSaveKeys");
    const msgEl = document.getElementById("settingsMsg");

    async function open() {
      modal.classList.add("active");
      const status = await fetchKeyStatus();
      PROVIDERS.forEach((p) => {
        const field = modal.querySelector(`.provider-field[data-provider="${p}"] .key-input`);
        if (field && status[p]) {
          field.placeholder = "•••••••••••• (tersimpan)";
        }
      });
    }

    function close() {
      modal.classList.remove("active");
      msgEl.textContent = "";
      msgEl.className = "msg";
    }

    btnOpen.addEventListener("click", open);
    btnClose.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    modal.querySelectorAll(".toggle-eye").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.previousElementSibling;
        const icon = btn.querySelector("i");
        if (input.type === "password") {
          input.type = "text";
          icon.className = "bi bi-eye-slash";
        } else {
          input.type = "password";
          icon.className = "bi bi-eye";
        }
      });
    });

    btnSave.addEventListener("click", async () => {
      const keysObj = {};
      PROVIDERS.forEach((p) => {
        const input = modal.querySelector(`.provider-field[data-provider="${p}"] .key-input`);
        if (input && input.value.trim()) {
          keysObj[p] = input.value.trim();
        }
      });

      try {
        btnSave.disabled = true;
        await saveKeys(keysObj);
        msgEl.textContent = "Pengaturan berhasil disimpan";
        msgEl.className = "msg success";
        modal.querySelectorAll(".key-input").forEach((i) => (i.value = ""));
      } catch (e) {
        msgEl.textContent = "Gagal menyimpan, coba lagi";
        msgEl.className = "msg";
      } finally {
        btnSave.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", initSettingsModal);

  window.SettingAI = {
    PROVIDERS,
    MODELS,
    getDeviceId,
    getSelectedModel,
    setSelectedModel,
    fetchKeyStatus,
    saveKeys
  };

})();
