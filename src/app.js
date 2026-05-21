import { getState, getSet, setActiveSetId, setLearnSession } from "./state.js";
import { initAudioDB, loadState, loadLearnSession, clearLearnSessionStorage } from "./storage.js";
import { showHome, showSetView, showModal, hideModal, hideAllModals } from "./navigation.js";
import { renderHome, renderSetView } from "./render.js";
import { loadVoices, speak, preCacheCards } from "./tts.js";
import { cleanupOldData } from "./analytics.js";

import { fetchStudySetsFromSQL } from "./api.js";
import "./admin.js";
import { flashcardState, prevFlashcard, nextFlashcard, updateFlashcardDisplay } from "./flashcard.js";
import { navigateToLearnMode, handleResumeSession, handleContinueLearning, nextQuestion } from "./learn.js";
import { handleResetProgress, handleToggleStar, handleDeleteCurrentSet, handleStudy5Min, handleReviewAllDue, setupLevelFilter, handleRandomSet } from "./crud.js";

// 🔥 NẠP 2 MODULE VỪA TÁCH VÀO ĐÂY
import { setupAuthListeners } from "./auth.js";
import { setupEditorListeners } from "./editor.js";

// Các hàm rỗng không bị mất
function handleUpdateCard(cardId, field, value) {}
function handleSpeak(text) { speak(text); }
function handleCreateSet(name) { return null; }
function loadSettingsModal() {}
function loadLearnSettingsModal() {}
function loadKeyboardSettingsModal() {}
function handleKeyboard(e) {}

// ĐIỀU HƯỚNG TRANG CHÍNH
window.navigateToHome = async function() {
  document.getElementById("adminView")?.classList.add("hidden");
  const { updateDashboardProgress } = await import("./render.js");

  showHome(() => {
    renderHome({
      onCreateSet: () => showModal("createSetModal"),
      onSelectSet: window.navigateToSetView,
      onResumeSession: handleResumeSession,
      onStudy5Min: handleStudy5Min,
      onReviewDue: handleReviewAllDue,
      onRandomSet: handleRandomSet,
      onResetProgress: handleResetProgress,
    });

    updateDashboardProgress();
    setupLevelFilter();
    window.applyRolePermissions();
  });
};

window.navigateToSetView = function(setId) {
  document.getElementById("adminView")?.classList.add("hidden");
  setActiveSetId(setId);
  const set = getSet(setId);
  if (set && set.cards.length > 0) {
    flashcardState.cardOrder = set.cards.map((_, i) => i);
    flashcardState.currentIndex = 0;
    flashcardState.isFlipped = false;
  }

  showSetView(setId, () => {
    renderSetView(setId, {
      currentIndex: flashcardState.currentIndex,
      cardOrder: flashcardState.cardOrder,
      onToggleStar: handleToggleStar,
      onSpeak: handleSpeak,
      onDeleteCard: async (cardId) => window.deleteSingleCard(cardId),
      onUpdateCard: handleUpdateCard,
    });
    window.applyRolePermissions();
    setTimeout(() => { 
        if (typeof updateFlashcardDisplay === "function") updateFlashcardDisplay(); 
    }, 50);
  });

  if (set) {
    const starredCards = set.cards.filter((c) => c.starred);
    const nextCards = set.cards.slice(0, 5);
    preCacheCards([...starredCards, ...nextCards]);
  }
};

// ==========================================
// KHỞI ĐỘNG (ĐÃ FIX LỖI MÀN HÌNH TRẮNG)
// ==========================================
// TRONG HÀM initApp() CỦA FILE app.js
async function initApp() {
  console.log("StudySet đang khởi tạo...");
  
  // 1. Xin quyền thông báo (Đặt ở đầu để đảm bảo trình duyệt đã xin quyền xong)
  if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
      }
  }

  // 2. Khởi tạo các thành phần cốt lõi của ứng dụng
  await initAudioDB();
  loadState();

  const savedSession = loadLearnSession();
  if (savedSession) setLearnSession(savedSession);

  loadVoices();
  cleanupOldData();
  setupEventListeners();

  // 3. Xử lý đăng nhập
const userData = localStorage.getItem("quizlet_user");
  
  // 🔥 KIỂM TRA XEM TRÊN ĐƯỜNG LINK CÓ CHỨA LỜI GỌI TỪ EMAIL KHÔNG
  const urlParams = new URLSearchParams(window.location.search);
  const targetUser = urlParams.get('login'); 

  if (!userData) {
    // Nếu chưa đăng nhập -> Mở form login
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.classList.remove("hidden");
        
        // Ảo thuật đây: Nếu có tên từ email, tự động điền sẵn vào ô đăng nhập luôn!
        if (targetUser) {
            const usernameInput = document.getElementById("loginUsername"); // Đổi ID này cho đúng với HTML của ông
            if (usernameInput) usernameInput.value = targetUser;
        }
    }
  } else {
    // Nếu đã đăng nhập
    const currentUser = JSON.parse(userData);
    
    // Cảnh báo nếu đang dùng acc người khác mà bấm nhầm link của hocvienB
    if (targetUser && currentUser.username !== targetUser) {
        alert(`Cảnh báo: Email này gửi cho ${targetUser}, nhưng bạn đang đăng nhập bằng ${currentUser.username}. Hãy đăng xuất nếu muốn chuyển tài khoản!`);
    }

    window.applyRolePermissions(); 
    await fetchStudySetsFromSQL();
    window.navigateToHome();
    
    if (Notification.permission === "granted") {
        new Notification("StudySet Online! 📚", {
            body: `Chào mừng ${currentUser.username} quay trở lại!`,
            icon: "https://cdn-icons-png.flaticon.com/512/3429/3429157.png" 
        });
    }
  }
  console.log("StudySet ready!");
}

// 🔥 Chạy ngay lập tức nếu HTML đã load xong
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
// ==========================================

// BỘ LẮNG NGHE SỰ KIỆN GỌN NHẸ
function setupEventListeners() {
  // 1. Gọi các Listener từ file tách ra
  setupAuthListeners();
  setupEditorListeners();

  // 2. Các nút giao diện (Navigation & Modal)
  document.getElementById("navAdminPanelBtn")?.addEventListener("click", window.navigateToAdminPanel);
  document.getElementById("homeCreateSetBtn")?.addEventListener("click", () => showModal("createSetModal"));
  document.getElementById("homeSettingsBtn")?.addEventListener("click", () => { loadSettingsModal(); showModal("settingsModal"); });
  document.getElementById("quickActionDue")?.addEventListener("click", handleReviewAllDue);
  document.getElementById("quickActionRandom")?.addEventListener("click", handleRandomSet);
  document.getElementById("setViewBackBtn")?.addEventListener("click", window.navigateToHome);
  document.getElementById("setViewLearnBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId));
  document.getElementById("setViewAddCardBtn")?.addEventListener("click", () => showModal("addCardModal"));
  document.getElementById("setViewDeleteBtn")?.addEventListener("click", handleDeleteCurrentSet);
  document.getElementById("bulkImportBtn")?.addEventListener("click", () => showModal("bulkImportModal"));
  document.getElementById("setViewStarredBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId, { mode: "starred" }));
  document.getElementById("setViewDueBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId, { mode: "due" }));
  
  // 3. Flashcard Controls
  document.getElementById("flashcard")?.addEventListener("click", window.flipFlashcard);
  document.getElementById("flashcardPrev")?.addEventListener("click", (e) => { e.stopPropagation(); prevFlashcard(); });
  document.getElementById("flashcardNext")?.addEventListener("click", (e) => { e.stopPropagation(); nextFlashcard(); });

  // 4. TTS Loa
  window.handleSpeak = function(text) { 
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(msg);
  };

  document.addEventListener("click", (e) => {
    const speakBtn = e.target.closest("#flashcardSpeakBtn");
    if (speakBtn) {
        e.stopPropagation();
        const currentId = getState().activeSetId;
        const set = getSet(currentId);
        if (!set || set.cards.length === 0) return;
        const cardIndex = flashcardState.cardOrder[flashcardState.currentIndex];
        const card = set.cards[cardIndex];
        if (card) {
            const textToRead = flashcardState.isFlipped ? card.definition : card.term;
            window.handleSpeak(textToRead);
        }
    }
  });

  // 5. Học & Điều hướng chung
  document.getElementById("learnExitBtn")?.addEventListener("click", async () => {
      await fetchStudySetsFromSQL();
      window.navigateToHome();
      try {
        const { updateDashboardProgress } = await import("./render.js");
        updateDashboardProgress();
      } catch (e) {}
  });

  document.getElementById("nextQuestionBtn")?.addEventListener("click", nextQuestion);
  document.getElementById("continueBtn")?.addEventListener("click", handleContinueLearning);
  document.getElementById("setViewResetBtn")?.addEventListener("click", () => handleResetProgress(getState().activeSetId));
  document.querySelectorAll(".modal-overlay").forEach((overlay) => overlay.addEventListener("click", hideAllModals));
  document.addEventListener("keydown", handleKeyboard);

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return; 
    const text = btn.innerText || btn.textContent || "";
    if (text.includes("Restart Session")) {
      await fetchStudySetsFromSQL();
      const activeSetId = getState().activeSetId;
      if (typeof clearLearnSessionStorage === "function") clearLearnSessionStorage();
      navigateToLearnMode(activeSetId);
    }
    if (text.includes("Back to Set")) {
      await fetchStudySetsFromSQL();
      window.navigateToHome();
      try {
        const { updateDashboardProgress } = await import("./render.js");
        updateDashboardProgress();
      } catch (err) {}
    }
  });
}

// BỘ TÌM KIẾM
document.addEventListener("input", (e) => {
    if (e.target.id === "editorSearchInput") {
        const searchTerm = e.target.value.toLowerCase().trim();
        const allSetCards = document.querySelectorAll(".set-card"); 
        allSetCards.forEach(card => {
            const titleEl = card.querySelector("h3");
            if (titleEl) {
                const title = titleEl.innerText.toLowerCase();
                if (title.includes(searchTerm)) {
                    card.style.display = ""; 
                } else {
                    card.style.display = "none"; 
                }
            }
        });
    }
});
