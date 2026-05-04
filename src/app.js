/**
 * app.js - Main Application Entry Point
 * BẢN FULL HOÀN THIỆN: ĐÃ FIX LOAD SAO TỪ SQL + XÓA GIẬT LAG KHI ĐÁNH SAO + TÍCH HỢP ADMIN PANEL
 */

import {
  getState,
  setState,
  getAllSets,
  getSet,
  getActiveSet,
  setActiveSetId,
  createSet,
  addSet,
  updateSet,
  deleteSet as deleteSetFromState,
  createCard,
  addCardToSet,
  updateCard,
  deleteCard as deleteCardFromState,
  toggleCardStar,
  getLearnSession,
  setLearnSession,
  clearLearnSession,
  createLearnSession,
  getDueCards,
  getStarredCards,
  getTtsState,
  updateTtsState,
  getSettings,
  updateKeyBindings,
  getFeatures,
  toggleFeature,
  initializeState,
  exportState,
  generateUUID,
} from "./state.js";

import {
  saveState,
  loadState,
  saveLearnSession,
  loadLearnSession,
  clearLearnSessionStorage,
  initAudioDB,
  exportSetToJSON,
  importSetFromJSON,
  downloadJSON,
  uploadJSON,
} from "./storage.js";

import {
  showHome,
  showSetView,
  showLearnMode,
  hideAllModals,
  showModal,
  hideModal,
  SECTIONS,
  MODALS,
  getCurrentSection,
  isModalOpen,
} from "./navigation.js";

import {
  renderHome,
  renderSetView,
  renderLearnMode,
  renderLearnQuestion,
  renderAnswerFeedback,
  renderLearnFeedback,
  renderLearnSummary,
  renderLearnCompletion,
  resetLearnUI,
  shuffleArray,
  escapeHtml,
} from "./render.js";

import { speak, stop as stopTTS, loadVoices, preCacheCards } from "./tts.js";

import {
  calculateSM2,
  GRADES,
  GRADE_LABELS,
  getDueCards as getDueCardsFromArray,
  isCardDue,
  getMasteryLevel,
} from "./spacedRep.js";

import {
  recordCardStudy,
  recordSessionTime,
  cleanupOldData,
} from "./analytics.js";

// ============================================================
// APPLICATION STATE
// ============================================================
let flashcardState = { currentIndex: 0, cardOrder: [], isFlipped: false };
let learnState = { sessionStartTime: null, batchHistory: [] };

// ============================================================
// ĐỒNG BỘ DỮ LIỆU TỪ SQL SERVER
// ============================================================
async function fetchStudySetsFromSQL() {
  try {
    const userData = JSON.parse(localStorage.getItem("quizlet_user"));
    const userId = userData ? userData.id : 0;

    console.log("Đang gọi API lấy dữ liệu từ SQL...");

    const response = await fetch(
      `https://localhost:7077/api/StudySets?userId=${userId}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) throw new Error("Không gọi được API!");
    const sqlData = await response.json();

    const currentState = getState();
    currentState.sets = {};
    setState(currentState);

    sqlData.forEach((sqlSet) => {
      const setObj = {
        uuid: sqlSet.id.toString(),
        name: sqlSet.title,
        description: sqlSet.description || "",
        createdAt: sqlSet.createdAt || Date.now(),
        updatedAt: Date.now(),
        cards: [],
      };

      if (sqlSet.flashcards && sqlSet.flashcards.length > 0) {
        sqlSet.flashcards.forEach((sqlCard) => {
          setObj.cards.push({
            uuid: sqlCard.id.toString(),
            id: sqlCard.id,
            term: sqlCard.term,
            definition: sqlCard.definition,
            starred: sqlCard.isStarred || sqlCard.IsStarred || false,
            stats: {
              repetitions: sqlCard.repetitions,
              interval: sqlCard.interval,
              easeFactor: sqlCard.easeFactor,
              dueAt: sqlCard.nextReviewDate
                ? new Date(sqlCard.nextReviewDate).getTime()
                : null,
            },
          });
        });
      }
      addSet(setObj);
    });

    saveState();
  } catch (error) {
    console.error("Lỗi đồng bộ SQL:", error);
  }
}

// ============================================================
// INITIALIZATION (KHỞI ĐỘNG)
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("StudySet đang khởi tạo...");
  await initAudioDB();
  loadState();

  const savedSession = loadLearnSession();
  if (savedSession) setLearnSession(savedSession);

  loadVoices();
  cleanupOldData();
  setupEventListeners();

  const userData = localStorage.getItem("quizlet_user");
  if (!userData) {
    const loginModal = document.getElementById("loginModal");
    if (loginModal) loginModal.classList.remove("hidden");
  } else {
    checkPermissions();
    await fetchStudySetsFromSQL();
    navigateToHome();
  }
  console.log("StudySet ready!");
});

// ============================================================
// ADMIN PANEL LOGIC (MỚI THÊM)
// ============================================================
window.navigateToAdminPanel = async function (e) {
  // Chặn trình duyệt load lại linh tinh
  if (e) e.preventDefault();
  console.log("🚀 Đã bấm nút Admin Panel!");

  // 1. Ép cái URL trên thanh địa chỉ thành #admin để cắt đuôi thằng Home
  window.location.hash = "admin";

  // 2. Ẩn TOÀN BỘ các view khác đi
  document.getElementById("homeView")?.classList.add("hidden");
  document.getElementById("setView")?.classList.add("hidden");
  document.getElementById("learnView")?.classList.add("hidden");

  // 3. Hiện màn hình Admin
  const adminView = document.getElementById("adminView");
  if (adminView) {
    adminView.classList.remove("hidden");
    console.log("✅ Đã bật giao diện Admin thành công!");
  } else {
    console.error(
      "❌ CẢNH BÁO: Không tìm thấy id='adminView' trong file html!",
    );
  }

  // 4. Gọi hàm load danh sách User
  await loadAdminUsers();
};

async function loadAdminUsers() {
  try {
    const res = await fetch("https://localhost:7077/api/Users");
    const users = await res.json();

    const tbody = document.getElementById("adminUserTableBody");
    if (!tbody) return;

    tbody.innerHTML = users
      .map(
        (u) => `
          <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
              <td class="px-6 py-4 text-slate-600">${u.id}</td>
              <td class="px-6 py-4 font-medium text-slate-800">${u.username}</td>
              <td class="px-6 py-4 text-slate-600">${u.email || "N/A"}</td>
              <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded text-xs font-bold ${u.role === "Admin" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}">${u.role}</span>
              </td>
              <td class="px-6 py-4 text-right">
                  ${
                    u.role !== "Admin"
                      ? `<button onclick="window.deleteUser(${u.id})" class="text-red-500 hover:text-red-700 font-semibold text-sm transition-colors">Delete User</button>`
                      : `<span class="text-slate-400 text-sm">Cannot be deleted</span>`
                  }
              </td>
          </tr>
      `,
      )
      .join("");
  } catch (err) {
    console.error("Lỗi lấy danh sách user:", err);
  }
}

// Hàm Xóa User (Đẩy ra window để nút click trong HTML gọi được)
window.deleteUser = async function (id) {
  if (
    !confirm(
      "Ông có chắc muốn xóa vĩnh viễn thằng User này không? Cả tiến độ học của nó cũng bay luôn đó!",
    )
  )
    return;

  try {
    const res = await fetch(`https://localhost:7077/api/Users/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      alert("Đã tiễn nó ra đảo thành công!");
      loadAdminUsers(); // Load lại bảng
    } else {
      alert("Xóa thất bại!");
    }
  } catch (err) {
    console.error("Lỗi xóa user:", err);
  }
};

// ============================================================
// NAVIGATION & PERMISSION HANDLERS
// ============================================================
function checkPermissions() {
  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  if (!userData) return;

  const isAdmin = userData.role === "Admin";

  const createSetBtn = document.getElementById("homeCreateSetBtn");
  const addCardBtn = document.getElementById("setViewAddCardBtn");
  const deleteSetBtn = document.getElementById("setViewDeleteBtn");
  const bulkImportBtn = document.getElementById("bulkImportBtn");
  const adminPanelBtn = document.getElementById("navAdminPanelBtn"); // Nút admin

  if (!isAdmin) {
    if (createSetBtn) createSetBtn.classList.add("hidden");
    if (addCardBtn) addCardBtn.classList.add("hidden");
    if (deleteSetBtn) deleteSetBtn.classList.add("hidden");
    if (bulkImportBtn) bulkImportBtn.classList.add("hidden");
    if (adminPanelBtn) adminPanelBtn.classList.add("hidden"); // Ẩn nút Admin
  } else {
    if (createSetBtn) createSetBtn.classList.remove("hidden");
    if (addCardBtn) addCardBtn.classList.remove("hidden");
    if (deleteSetBtn) deleteSetBtn.classList.remove("hidden");
    if (bulkImportBtn) bulkImportBtn.classList.remove("hidden");
    if (adminPanelBtn) adminPanelBtn.classList.remove("hidden"); // Hiện nút Admin
  }
}

async function navigateToHome() {
  // Ẩn trang Admin nếu đang mở
  document.getElementById("adminView")?.classList.add("hidden");

  const { updateDashboardProgress } = await import("./render.js");

  showHome(() => {
    renderHome({
      onCreateSet: () => showModal("createSetModal"),
      onSelectSet: navigateToSetView,
      onResumeSession: handleResumeSession,
      onStudy5Min: handleStudy5Min,
      onReviewDue: handleReviewAllDue,
      onRandomSet: handleRandomSet,
      onResetProgress: handleResetProgress,
    });

    updateDashboardProgress();
    setupLevelFilter();
  });
}
function navigateToSetView(setId) {
  // Ẩn trang Admin nếu đang mở
  document.getElementById("adminView")?.classList.add("hidden");

  setActiveSetId(setId);
  saveState();
  const set = getSet(setId);
  if (set && set.cards.length > 0) {
    flashcardState.cardOrder = set.cards.map((_, i) => i);
    flashcardState.currentIndex = 0;
    flashcardState.isFlipped = false;
  }

  showSetView(setId, () => {
    // 1. Hàm này vẽ lại toàn bộ giao diện HTML mới tinh
    renderSetView(setId, {
      currentIndex: flashcardState.currentIndex,
      cardOrder: flashcardState.cardOrder,
      onToggleStar: handleToggleStar,
      onSpeak: handleSpeak,
      onDeleteCard: handleDeleteCard,
      onUpdateCard: handleUpdateCard,
    });

    // 🔥 2. LÍNH ĐÁNH THUÊ: Đi dọn dẹp ngay sau khi HTML vừa được vẽ ra
    const userData = JSON.parse(localStorage.getItem("quizlet_user"));
    if (userData && userData.role && userData.role.toLowerCase() === "admin") {
      // Tắt cái nút "Starred ( 3 )" màu vàng bự chà bá
      const starBtn = document.getElementById("setViewStarredBtn");
      if (starBtn) starBtn.style.display = "none";

      // Truy cùng diệt tận mấy nút ngôi sao nhỏ xíu trên từng thẻ
      const allButtons = document.querySelectorAll("button");
      allButtons.forEach((btn) => {
        // Quét thấy nút nào có icon "star" hoặc chữ "Starred" là ép tàng hình luôn!
        if (
          btn.innerHTML.includes("star") ||
          btn.innerText.includes("Starred")
        ) {
          btn.style.display = "none";
        }
      });
    }
  });

  if (set) {
    const starredCards = set.cards.filter((c) => c.starred);
    const nextCards = set.cards.slice(0, 5);
    preCacheCards([...starredCards, ...nextCards]);
  }
  checkPermissions();
}
function navigateToLearnMode(setId, options = {}) {
  const { resume = false, mode = "all" } = options;
  setActiveSetId(setId);
  const set = getSet(setId);
  if (!set) return;

  let session;
  const savedSession = loadLearnSession();

  // 🔥 FIX BỊ KẸT CHẾ ĐỘ:
  // Chỉ khôi phục bài học cũ nếu nó CÙNG MODE với nút ông vừa bấm!
  if (
    savedSession &&
    savedSession.setId === setId &&
    savedSession.unseenIds.length > 0 &&
    savedSession.mode === mode
  ) {
    session = savedSession;
  } else {
    // Nếu bấm nút Due mà trong máy đang lưu bài của All -> Dẹp, tạo phòng Due mới tinh!
    session = initializeNewSession(set, mode);
  }

  if (!session) return;

  setLearnSession(session);
  saveLearnSession(session);
  learnState.sessionStartTime = Date.now();
  learnState.batchHistory = [];

  showLearnMode(setId, options, () => {
    resetLearnUI();
    nextQuestion();
  });
}
function initializeNewSession(set, mode) {
  let cards;
  if (mode === "starred") {
    cards = set.cards.filter((c) => c.starred);
  } else if (mode === "due") {
    // 🔥 LOGIC CHUẨN: Chỉ lấy những từ ĐÃ HỌC (repetitions > 0). LOẠI SẠCH TỪ "NEW"
    cards = set.cards.filter(
      (c) => c.stats && (c.stats.repetitions > 0 || c.stats.Repetitions > 0),
    );
  } else {
    cards = set.cards;
  }

  // Tui nới lỏng luôn: 1 thẻ đến hạn cũng cho vào phòng ôn tập, không bắt ép 2 thẻ nữa!
  if (cards.length < 1) {
    alert(`Không có thẻ nào phù hợp để học!`);
    return null;
  }

  const shuffled = shuffleArray(cards);
  return createLearnSession(
    set.uuid,
    shuffled.map((c) => c.uuid),
    mode,
  );
}

// ============================================================
// LEARN MODE HANDLERS
// ============================================================
function nextQuestion() {
  const session = getLearnSession();
  const set = getActiveSet();
  if (!session || !set) return;

  if (
    session.questionsAnswered > 0 &&
    session.questionsAnswered % 10 === 0 &&
    learnState.batchHistory.length > 0
  ) {
    renderLearnSummary(learnState.batchHistory);
    return;
  }
  if (session.unseenIds.length === 0) {
    handleLearnComplete();
    return;
  }

  session.currentQuestionId = session.unseenIds[0];
  setLearnSession(session);
  saveLearnSession(session);
  resetLearnUI();
  renderLearnMode(session, set, {
    onGrade: handleGrade,
    onAnswer: handleMultipleChoiceAnswer,
    onWordClick: handleWordClick,
  });

  const ttsState = getTtsState();
  if (ttsState.autoRead) {
    const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
    if (card) speak(card.definition);
  }
}
async function handleGrade(grade) {
  const session = getLearnSession();
  const set = getActiveSet();
  const userData =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  const userId = userData ? userData.id || userData.Id : 1;

  if (!session || !set) return;
  const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
  if (!card) return;

  const newStats = calculateSM2(card.stats, grade);
  updateCard(set.uuid, card.uuid, { stats: newStats });
  saveState();

  const isCorrect = grade >= GRADES.GOOD; // Cứ tính là đúng nếu điểm cao
  const realCardId = card.id || parseInt(card.uuid);

  try {
    fetch("https://localhost:7077/api/StudyProgresses/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, flashcardId: realCardId, grade }),
    });
  } catch (err) {}

  // 🔥 LOGIC CHUẨN: TRẢ LỜI ĐÚNG -> TẮT SAO ĐI
  if (isCorrect && session.mode === "starred" && card.starred) {
    card.starred = false;
    saveState();
    try {
      fetch(
        `https://localhost:7077/api/Flashcards/toggle-star/${realCardId}/${userId}`,
        { method: "POST" },
      );
      console.log(`🌟 Từ [${card.term}] đã thuộc! Đã tháo sao.`);
    } catch (err) {}
  }

  recordCardStudy(isCorrect);
  session.questionsAnswered++;
  learnState.batchHistory.push({
    card: { term: card.term, definition: card.definition },
    correct: isCorrect,
    grade,
  });

  if (isCorrect) {
    session.unseenIds.shift();
    session.masteredIds.push(card.uuid);
    session.correctCount++;
    setTimeout(nextQuestion, 800);
  } else {
    session.unseenIds.shift();
    const insertIndex = Math.min(
      session.unseenIds.length,
      Math.floor(Math.random() * 3) + 2,
    );
    session.unseenIds.splice(insertIndex, 0, card.uuid);
    renderLearnFeedback(false, card.term);
  }
  setLearnSession(session);
  saveLearnSession(session);
}
function handleMultipleChoiceAnswer(isCorrect, selectedBtn, correctId) {
  const session = getLearnSession();
  if (!session) return;

  if (typeof renderAnswerFeedback === "function") {
    renderAnswerFeedback(selectedBtn, correctId, isCorrect);
  }

  const userData =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  const userId = userData ? userData.id || userData.Id : 1;
  const gradeValue = isCorrect ? 4 : 1;

  const set = getActiveSet();
  const card = set?.cards.find(
    (c) =>
      c.uuid == session.currentQuestionId || c.id == session.currentQuestionId,
  );
  const realCardId = card ? card.id : parseInt(session.currentQuestionId);

  // Gửi điểm
  fetch("https://localhost:7077/api/StudyProgresses/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      flashcardId: realCardId,
      grade: gradeValue,
    }),
  }).catch((err) => console.error(err));

  // 🔥 LOGIC CHUẨN: TRẢ LỜI ĐÚNG -> TẮT SAO ĐI
  if (isCorrect && session.mode === "starred" && card && card.starred) {
    card.starred = false; // Ép tắt sao ở trình duyệt
    saveState();
    try {
      fetch(
        `https://localhost:7077/api/Flashcards/toggle-star/${realCardId}/${userId}`,
        { method: "POST" },
      );
      console.log(`🌟 Từ [${card.term}] đã thuộc! Đã tháo sao.`);
    } catch (err) {}
  }

  // Chuyển câu
  session.questionsAnswered++;
  if (isCorrect) {
    session.correctCount++;
    session.unseenIds.shift();
    session.masteredIds.push(session.currentQuestionId);
  } else {
    const wrongCardId = session.unseenIds.shift();
    session.unseenIds.push(wrongCardId);
  }

  setLearnSession(session);
  saveLearnSession(session);

  setTimeout(() => {
    try {
      if (isCorrect) nextQuestion();
      else {
        if (typeof renderLearnFeedback === "function" && card)
          renderLearnFeedback(false, card.term);
        else nextQuestion();
      }
    } catch (error) {
      nextQuestion();
    }
  }, 800);
}

function handleLearnComplete() {
  const session = getLearnSession();

  if (learnState.sessionStartTime) {
    const minutes = Math.round(
      (Date.now() - learnState.sessionStartTime) / 60000,
    );
    try {
      recordSessionTime(minutes);
    } catch (e) {}
  }

  clearLearnSessionStorage();
  clearLearnSession();
  renderLearnCompletion();

  setTimeout(() => {
    const restartBtn =
      document.querySelector(".congrats-modal button:first-child") ||
      document.querySelector('button[onclick*="restart"]');

    if (restartBtn) {
      restartBtn.onclick = (e) => {
        e.preventDefault();
        const activeSetId = getState().activeSetId;
        navigateToLearnMode(activeSetId);
      };
    }

    const backBtn =
      document.querySelector(".congrats-modal button:last-child") ||
      document.querySelector('button[onclick*="back"]');

    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        const activeSetId = getState().activeSetId;
        window.location.hash = `#set/${activeSetId}`;
      };
    }
  }, 100);
}

function handleResumeSession(savedSession) {
  navigateToLearnMode(savedSession.setId, {
    resume: true,
    mode: savedSession.mode,
  });
}

function handleContinueLearning() {
  learnState.batchHistory = [];
  resetLearnUI();
  nextQuestion();
}

// ============================================================
// QUICK ACTION HANDLERS
// ============================================================
function handleStudy5Min() {
  const allSets = getAllSets();
  const setIds = Object.keys(allSets);
  if (setIds.length === 0) return alert("Chưa có bộ thẻ nào để học ông ơi!");

  let bestSetId = setIds[0];
  let maxDue = 0;

  setIds.forEach((id) => {
    const due = getDueCards(id).length;
    if (due > maxDue) {
      maxDue = due;
      bestSetId = id;
    }
  });
  navigateToLearnMode(bestSetId, { mode: maxDue > 0 ? "due" : "all" });
}

function handleReviewAllDue() {
  const allSets = getAllSets();
  const setIds = Object.keys(allSets);

  for (const id of setIds) {
    const due = getDueCards(id).length;
    if (due >= 1) {
      navigateToLearnMode(id, { mode: "due" });
      return;
    }
  }
  alert("Chúc mừng! Hiện tại không có thẻ nào đến hạn ôn tập.");
}

function setupLevelFilter() {
  const studySelect = document.getElementById("quickActionStudy");
  if (!studySelect) return;

  studySelect.addEventListener("change", (e) => {
    const level = e.target.value;
    const allCards = document.querySelectorAll(".set-card");

    allCards.forEach((card) => {
      const title = card.querySelector("h3").innerText.toUpperCase();
      let shouldShow = false;

      if (level === "all") {
        shouldShow = true;
      } else if (
        level === "easy" &&
        (title.includes("A1") || title.includes("A2"))
      ) {
        shouldShow = true;
      } else if (
        level === "medium" &&
        (title.includes("B1") || title.includes("B2"))
      ) {
        shouldShow = true;
      } else if (
        level === "hard" &&
        (title.includes("C1") || title.includes("C2"))
      ) {
        shouldShow = true;
      }

      card.style.display = shouldShow ? "" : "none";
    });
  });
}

function handleRandomSet() {
  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter(
    (id) => allSets[id].cards.length >= 2,
  );

  if (setIds.length === 0)
    return alert("Kiếm bộ nào có từ 2 thẻ trở lên mới chơi random được!");

  const randomId = setIds[Math.floor(Math.random() * setIds.length)];
  navigateToLearnMode(randomId, { mode: "all" });
}

// ============================================================
// CARD & SET HANDLERS
// ============================================================
async function handleResetProgress(setId) {
  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  if (!userData) return alert("Phải đăng nhập mới reset được ông ơi!");

  if (
    !confirm(
      "Ông có chắc muốn xóa sạch tiến độ bộ này để học lại từ đầu không?",
    )
  )
    return;

  try {
    const response = await fetch(
      `https://localhost:7077/api/StudyProgresses/reset/${setId}/${userData.id}`,
      {
        method: "DELETE",
      },
    );

    if (response.ok) {
      alert("Đã xóa sạch bộ nhớ, tiến độ về 0%!");
      const { updateDashboardProgress } = await import("./render.js");
      updateDashboardProgress();
      navigateToHome();
    }
  } catch (err) {
    console.error("Lỗi reset:", err);
  }
}

async function handleToggleStar(cardId) {
  const currentState = getState();
  const setId = currentState.activeSetId;
  const set = currentState.sets[setId];
  if (!set) return;

  // Trả lại sự trong sáng: Không lật ngược biến nữa vì File giao diện nó làm rồi
  saveState();

  const userData =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  const userId = userData ? userData.id || userData.Id : 1;

  // Bắn lên C# để lưu
  try {
    fetch(
      `https://localhost:7077/api/Flashcards/toggle-star/${cardId}/${userId}`,
      { method: "POST" },
    );
  } catch (err) {
    console.error("Lỗi đồng bộ sao", err);
  }
}

function handleUpdateCard(cardId, field, value) {}
function handleSpeak(text) {
  speak(text);
}
function handleCreateSet(name) {
  return null;
}

async function handleDeleteCard(cardId) {
  if (!confirm("Ông có chắc muốn xóa thẻ này vĩnh viễn không?")) return;

  try {
    const response = await fetch(
      `https://localhost:7077/api/Flashcards/${cardId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      alert("Lỗi: Backend từ chối xóa thẻ này!");
      return;
    }

    const currentState = getState();
    const activeSetId = currentState.activeSetId;
    const currentSet = currentState.sets[activeSetId];

    if (currentSet && currentSet.cards) {
      currentSet.cards = currentSet.cards.filter(
        (card) => card.uuid !== cardId && card.id !== cardId,
      );
      setState(currentState);
      saveState(currentState);
    }

    alert("Xóa thành công!");
    window.location.hash = "#home";
    window.dispatchEvent(new Event("hashchange"));
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối Backend rồi ông ơi!");
  }
}

async function handleDeleteCurrentSet() {
  const activeSetId = getState().activeSetId;
  if (!activeSetId) return;

  if (!confirm("CẢNH BÁO: Ông sắp xóa TOÀN BỘ bộ thẻ này. Chắc chắn chưa?"))
    return;

  try {
    const response = await fetch(
      `https://localhost:7077/api/StudySets/${activeSetId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      alert("Lỗi: Không xóa được bộ thẻ!");
      return;
    }

    const currentState = getState();
    if (currentState.sets[activeSetId]) {
      delete currentState.sets[activeSetId];
      setState(currentState);
      saveState(currentState);
    }

    alert("Xóa thành công!");
    window.location.hash = "#home";
    window.dispatchEvent(new Event("hashchange"));
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối Backend!");
  }
}

// ============================================================
// FLASHCARD DISPLAY LOGIC
// ============================================================
function flipFlashcard() {
  const flashcard = document.getElementById("flashcard");
  if (!flashcard) return;
  flashcardState.isFlipped = !flashcardState.isFlipped;
  flashcard.classList.toggle("flipped", flashcardState.isFlipped);
}

function nextFlashcard() {
  const set = getActiveSet();
  if (!set || set.cards.length === 0) return;
  flashcardState.currentIndex =
    (flashcardState.currentIndex + 1) % set.cards.length;
  flashcardState.isFlipped = false;
  updateFlashcardDisplay();
}

function prevFlashcard() {
  const set = getActiveSet();
  if (!set || set.cards.length === 0) return;
  flashcardState.currentIndex =
    (flashcardState.currentIndex - 1 + set.cards.length) % set.cards.length;
  flashcardState.isFlipped = false;
  updateFlashcardDisplay();
}

function updateFlashcardDisplay() {
  const set = getActiveSet();
  if (!set) return;
  const card = set.cards[flashcardState.cardOrder[flashcardState.currentIndex]];
  if (!card) return;
  document.getElementById("flashcardFront").textContent = card.term;
  document.getElementById("flashcardBack").textContent = card.definition;
  document.getElementById("flashcardCounter").textContent =
    `${flashcardState.currentIndex + 1} / ${set.cards.length}`;
  document.getElementById("flashcard").classList.remove("flipped");
}

// ============================================================
// MODAL & SETTINGS LOADING
// ============================================================
function loadSettingsModal() {}
function loadLearnSettingsModal() {}
function loadKeyboardSettingsModal() {}
async function handleWordClick(word, x, y) {}
function handleKeyboard(e) {}

export function setupEventListeners() {
    // =====================================================================
    // 1. AUTHENTICATION (ĐĂNG NHẬP / ĐĂNG KÝ VỚI C# BACKEND)
    // =====================================================================
    
    // --- Đăng nhập ---
    document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("loginUsername").value;
        const password = document.getElementById("loginPassword").value;
        
        try {
            const response = await fetch("https://localhost:7077/api/Accounts/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem("quizlet_user", JSON.stringify(data));
                alert("Login successful! Hello " + data.username);
                location.reload();
            } else {
                alert(data.message || "Lỗi đăng nhập!");
            }
        } catch (err) {
            alert("Backend chưa bật hoặc sai cổng 7077!");
        }
    });

    // --- Chuyển đổi giao diện Đăng nhập <-> Đăng ký ---
    document.getElementById("showRegisterBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("loginForm").classList.add("hidden");
        document.getElementById("registerForm").classList.remove("hidden");
        
        const modalTitle = document.querySelector("#loginModal h2");
        if (modalTitle) modalTitle.innerText = "Register for an account now!";
    });

    document.getElementById("showLoginBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("registerForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");
        
        const modalTitle = document.querySelector("#loginModal h2");
        if (modalTitle) modalTitle.innerText = "Welcome to the website!";
    });

    // --- Đăng ký ---
    document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("regUsername").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("regConfirmPassword").value;

        // Ràng buộc Username (3-20 ký tự, không ký tự đặc biệt)
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            alert("Tên đăng nhập phải từ 3-20 ký tự, viết liền không dấu và không chứa ký tự đặc biệt nha ní!");
            return;
        }

        // Ràng buộc Password (tối thiểu 6 ký tự)
        if (password.length < 6) {
            alert("Mật khẩu gì mà ngắn ngủn vậy! Đặt ít nhất 6 ký tự cho an toàn nhé!");
            return;
        }

        // Kiểm tra khớp Password
        if (password !== confirmPassword) {
            alert("Ê ní ơi, 2 cái mật khẩu nó đấm nhau kìa! Nhập lại cho giống nhau nha!");
            return;
        }

        try {
            const response = await fetch("https://localhost:7077/api/Accounts/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    passwordHash: password, // Lưu ý: Nếu C# bắt thuộc tính 'password', hãy đổi key này thành 'password'
                    role: "Learner"
                }),
            });
            
            if (response.ok) {
                alert("Đăng ký thành công! Quay lại đăng nhập thôi ní ơi!");
                document.getElementById("showLoginBtn").click();
                document.getElementById("registerForm").reset();
            } else {
                const data = await response.json();
                alert("Lỗi từ máy chủ: " + (data.message || data.title || "Có lỗi gì đó sai sai ở Backend!"));
            }
        } catch (err) {
            alert("Lỗi kết nối Backend! C# đang ngủ hả?");
        }
    });

    // --- Đăng xuất ---
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("quizlet_user");
        location.reload();
    });

    // =====================================================================
    // 2. NAVIGATION & HOME SCREEN
    // =====================================================================
    
    document.getElementById("navAdminPanelBtn")?.addEventListener("click", window.navigateToAdminPanel);
    
    document.getElementById("homeCreateSetBtn")?.addEventListener("click", () => showModal("createSetModal"));
    document.getElementById("homeSettingsBtn")?.addEventListener("click", () => {
        loadSettingsModal();
        showModal("settingsModal");
    });
    
    document.getElementById("quickActionDue")?.addEventListener("click", handleReviewAllDue);
    document.getElementById("quickActionRandom")?.addEventListener("click", handleRandomSet);

    // =====================================================================
    // 3. CREATE STUDY SET
    // =====================================================================
    
    document.getElementById("createSetForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("createSetNameInput").value.trim();
        const userData = JSON.parse(localStorage.getItem("quizlet_user"));
        
        if (name) {
            try {
                const response = await fetch("https://localhost:7077/api/StudySets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: name,
                        description: "",
                        isPublic: true,
                        userId: userData ? userData.id : 1,
                    }),
                });
                if (!response.ok) return alert("Lỗi: Backend từ chối lưu!");
                
                const result = await response.json();
                const newSetId = result.data.id.toString();
                
                hideModal("createSetModal");
                await fetchStudySetsFromSQL();
                navigateToSetView(newSetId);
            } catch (err) {
                alert("Lỗi kết nối Backend!");
            }
        }
    });

    // =====================================================================
    // 4. SET VIEW ACTIONS
    // =====================================================================
    
    document.getElementById("setViewBackBtn")?.addEventListener("click", navigateToHome);
    document.getElementById("setViewLearnBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId));
    document.getElementById("setViewAddCardBtn")?.addEventListener("click", () => showModal("addCardModal"));
    document.getElementById("setViewDeleteBtn")?.addEventListener("click", handleDeleteCurrentSet);
    document.getElementById("bulkImportBtn")?.addEventListener("click", () => showModal("bulkImportModal"));
    
    document.getElementById("setViewStarredBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId, { mode: "starred" }));
    document.getElementById("setViewDueBtn")?.addEventListener("click", () => navigateToLearnMode(getState().activeSetId, { mode: "due" }));

    // =====================================================================
    // 5. ADD CARD (SINGLE)
    // =====================================================================
    
    document.getElementById("addCardForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const term = document.getElementById("addCardTermInput").value.trim();
        const def = document.getElementById("addCardDefInput").value.trim();
        const activeSetId = getState().activeSetId;
        
        if (term && def) {
            try {
                const response = await fetch(`https://localhost:7077/api/Flashcards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        term: term,
                        definition: def,
                        studySetId: parseInt(activeSetId),
                        isStarred: false,
                    }),
                });
                if (!response.ok) return alert("Lưu thẻ thất bại!");
                
                hideModal("addCardModal");
                await fetchStudySetsFromSQL();
                navigateToSetView(activeSetId);
            } catch (err) {
                alert("Lỗi kết nối Backend!");
            }
        }
    });

    // =====================================================================
    // 6. BULK IMPORT CARDS
    // =====================================================================
    
    document.getElementById("bulkImportCloseBtn")?.addEventListener("click", () => hideModal("bulkImportModal"));
    document.getElementById("importBtn")?.addEventListener("click", async () => {
        const rawText = document.getElementById("importText").value.trim();
        const delimiter = document.getElementById("importDelimiter").value;
        const activeSetId = getState().activeSetId;
        
        if (!rawText) return alert("Dữ liệu trống kìa ông ơi!");

        let cardsToImport = [];
        const lines = rawText.split("\n").filter((l) => l.trim() !== "");

        if (delimiter === "newline") {
            for (let i = 0; i < lines.length; i += 2) {
                if (lines[i] && lines[i + 1]) {
                    cardsToImport.push({ term: lines[i].trim(), definition: lines[i + 1].trim() });
                }
            }
        } else {
            lines.forEach((line) => {
                let sep = delimiter;
                if (delimiter === "auto") {
                    if (line.includes("\t")) sep = "\t";
                    else if (line.includes(":")) sep = ":";
                    else if (line.includes(";")) sep = ";";
                    else if (line.includes(",")) sep = ",";
                    else sep = "-";
                } else if (delimiter === "tab") {
                    sep = "\t";
                }
                
                const parts = line.split(sep);
                if (parts.length >= 2) {
                    cardsToImport.push({ term: parts[0].trim(), definition: parts.slice(1).join(sep).trim() });
                }
            });
        }

        if (cardsToImport.length === 0) return alert("Không tìm thấy dữ liệu hợp lệ!");

        const btn = document.getElementById("importBtn");
        btn.disabled = true;
        btn.innerText = "Processing...";
        let successCount = 0;
        
        try {
            for (const card of cardsToImport) {
                const response = await fetch(`https://localhost:7077/api/Flashcards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        term: card.term,
                        definition: card.definition,
                        studySetId: parseInt(activeSetId),
                        isStarred: false,
                    }),
                });
                if (response.ok) successCount++;
            }
            alert(`Đã nạp thành công ${successCount}/${cardsToImport.length} thẻ vào SQL!`);
            document.getElementById("importText").value = "";
            hideModal("bulkImportModal");
            
            await fetchStudySetsFromSQL();
            navigateToSetView(activeSetId);
        } catch (err) {
            alert("Lỗi Backend!");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined">upload</span> Import Cards`;
        }
    });

    // =====================================================================
    // 7. FLASHCARD & UI CONTROLS (Lật thẻ, Loa)
    // =====================================================================
    
    document.getElementById("flashcard")?.addEventListener("click", flipFlashcard);
    document.getElementById("flashcardPrev")?.addEventListener("click", (e) => { e.stopPropagation(); prevFlashcard(); });
    document.getElementById("flashcardNext")?.addEventListener("click", (e) => { e.stopPropagation(); nextFlashcard(); });
    
    document.getElementById("flashcardSpeakBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const set = getActiveSet();
        if (!set || set.cards.length === 0) return;
        
        const cardIndex = flashcardState.cardOrder[flashcardState.currentIndex];
        const card = set.cards[cardIndex];
        if (card) {
            const textToRead = flashcardState.isFlipped ? card.definition : card.term;
            handleSpeak(textToRead);
        }
    });

    // =====================================================================
    // 8. LEARN MODE CONTROLS
    // =====================================================================
    
    document.getElementById("learnExitBtn")?.addEventListener("click", async () => {
        await fetchStudySetsFromSQL();
        navigateToHome();
        try {
            const { updateDashboardProgress } = await import("./render.js");
            updateDashboardProgress();
        } catch (e) {}
    });

    document.getElementById("nextQuestionBtn")?.addEventListener("click", nextQuestion);
    document.getElementById("continueBtn")?.addEventListener("click", handleContinueLearning);
    document.getElementById("setViewResetBtn")?.addEventListener("click", () => handleResetProgress(getState().activeSetId));

    // =====================================================================
    // 9. MODALS & GLOBAL EVENTS
    // =====================================================================
    
    document.querySelectorAll(".modal-overlay").forEach((overlay) => overlay.addEventListener("click", hideAllModals));
    document.addEventListener("keydown", handleKeyboard);

    // Xử lý sự kiện Màn hình Chúc mừng (End Session)
    document.addEventListener('click', async (e) => {
        if (e.target.innerText.includes("Restart Session")) {
            await fetchStudySetsFromSQL();
            const activeSetId = getState().activeSetId;
            if (typeof clearLearnSessionStorage === 'function') clearLearnSessionStorage();
            navigateToLearnMode(activeSetId);
        }
        
        if (e.target.innerText.includes("Back to Set")) {
            await fetchStudySetsFromSQL();
            navigateToHome();
            try {
                const { updateDashboardProgress } = await import("./render.js");
                updateDashboardProgress();
            } catch (err) {}
        }
    });
}

// ============================================================
// EVENT LISTENERS SETUP
// ============================================================
// function setupEventListeners() {
//   // --- 1. AUTH HANDLERS ---
//   document
//     .getElementById("loginForm")
//     ?.addEventListener("submit", async (e) => {
//       e.preventDefault();
//       const username = document.getElementById("loginUsername").value;
//       const password = document.getElementById("loginPassword").value;
//       try {
//         // 🔥 ĐỔI THÀNH LINK CỦA PHP:
//         const response = await fetch("http://localhost/quizlet_api/login.php", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ username, password }),
//         });
//         const data = await response.json();

//         if (response.ok) {
//           localStorage.setItem("quizlet_user", JSON.stringify(data));
//           alert("Login successful ! Hello " + data.username);
//           location.reload();
//         } else {
//           alert(data.message || "Lỗi đăng nhập!");
//         }
//       } catch (err) {
//         alert("Lỗi kết nối Backend PHP! Coi lại XAMPP bật chưa?");
//       }
//     });

//   // --- HIỆU ỨNG CHUYỂN QUA LẠI ĐĂNG NHẬP / ĐĂNG KÝ ---
//   document.getElementById("showRegisterBtn")?.addEventListener("click", (e) => {
//     e.preventDefault();
//     document.getElementById("loginForm").classList.add("hidden");
//     document.getElementById("registerForm").classList.remove("hidden");

//     const modalTitle = document.querySelector("#loginModal h2");
//     if (modalTitle) modalTitle.innerText = "Register for an account now!";
//   });

//   document.getElementById("showLoginBtn")?.addEventListener("click", (e) => {
//     e.preventDefault();
//     document.getElementById("registerForm").classList.add("hidden");
//     document.getElementById("loginForm").classList.remove("hidden");

//     const modalTitle = document.querySelector("#loginModal h2");
//     if (modalTitle) modalTitle.innerText = "Welcome to the website!";
//   });

//   // --- XỬ LÝ NÚT ĐĂNG KÝ BẮN LÊN API ---
//   document
//     .getElementById("registerForm")
//     ?.addEventListener("submit", async (e) => {
//       e.preventDefault();
//       const username = document.getElementById("regUsername").value.trim();
//       const email = document.getElementById("regEmail").value.trim();
//       const password = document.getElementById("regPassword").value;
//       const confirmPassword =
//         document.getElementById("regConfirmPassword").value;

//       // 🔥 1. RÀNG BUỘC USERNAME: Từ 3-20 ký tự, không ký tự đặc biệt
//       const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
//       if (!usernameRegex.test(username)) {
//         alert(
//           "Tên đăng nhập phải từ 3 đến 20 ký tự, viết liền không dấu và không chứa ký tự đặc biệt nha ní!",
//         );
//         return;
//       }

//       // 🔥 2. RÀNG BUỘC PASSWORD: Tối thiểu 6 ký tự
//       if (password.length < 6) {
//         alert(
//           "Mật khẩu gì mà ngắn ngủn vậy! Đặt ít nhất 6 ký tự cho nó an toàn nhé!",
//         );
//         return;
//       }

//       // 🔥 3. KIỂM TRA MẬT KHẨU CÓ KHỚP NHAU KHÔNG
//       if (password !== confirmPassword) {
//         alert(
//           "Ê ní ơi, 2 cái mật khẩu nó đấm nhau kìa! Nhập lại cho giống nhau nha!",
//         );
//         return;
//       }

//       // 🔥🔥🔥 ĐÃ THAY ĐỔI ĐƯỜNG LINK GỌI PHP Ở ĐÂY 🔥🔥🔥
//       try {
//         const response = await fetch(
//           "http://localhost/quizlet_api/register.php",
//           {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               username: username,
//               email: email,
//               passwordHash: password,
//               role: "Learner",
//             }),
//           },
//         );

//         if (response.ok) {
//           alert(
//             "Đăng ký thành công qua hệ thống PHP! Quay lại đăng nhập thôi!",
//           );
//           document.getElementById("showLoginBtn").click();
//           document.getElementById("registerForm").reset();
//         } else {
//           const data = await response.json();
//           alert("Lỗi: " + (data.message || "Bị lỗi gì đó rồi!"));
//         }
//       } catch (err) {
//         alert("Lỗi kết nối Backend PHP! Coi lại XAMPP bật chưa?");
//       }
//       // 🔥🔥🔥 KẾT THÚC PHẦN THAY ĐỔI 🔥🔥🔥
//     });

//   document.getElementById("logoutBtn")?.addEventListener("click", () => {
//     localStorage.removeItem("quizlet_user");
//     location.reload();
//   });

//   // --- NÚT ADMIN PANEL TỪ TRÊN NAVBAR ---
//   document
//     .getElementById("navAdminPanelBtn")
//     ?.addEventListener("click", window.navigateToAdminPanel);

//   // --- 2. HOME SCREEN ---
//   document
//     .getElementById("homeCreateSetBtn")
//     ?.addEventListener("click", () => showModal("createSetModal"));
//   document.getElementById("homeSettingsBtn")?.addEventListener("click", () => {
//     loadSettingsModal();
//     showModal("settingsModal");
//   });
//   document
//     .getElementById("quickActionDue")
//     ?.addEventListener("click", handleReviewAllDue);
//   document
//     .getElementById("quickActionRandom")
//     ?.addEventListener("click", handleRandomSet);

//   // --- 3. CREATE SET ---
//   document
//     .getElementById("createSetForm")
//     ?.addEventListener("submit", async (e) => {
//       e.preventDefault();
//       const name = document.getElementById("createSetNameInput").value.trim();
//       const userData = JSON.parse(localStorage.getItem("quizlet_user"));
//       if (name) {
//         try {
//           const response = await fetch("https://localhost:7077/api/StudySets", {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//               title: name,
//               description: "",
//               isPublic: true,
//               userId: userData ? userData.id : 1,
//             }),
//           });
//           if (!response.ok) return alert("Lỗi: Backend từ chối lưu!");
//           const result = await response.json();
//           const newSetId = result.data.id.toString();
//           hideModal("createSetModal");
//           await fetchStudySetsFromSQL();
//           navigateToSetView(newSetId);
//         } catch (err) {
//           alert("Lỗi kết nối Backend!");
//         }
//       }
//     });

//   // --- 4. SET VIEW ACTIONS ---
//   document
//     .getElementById("setViewBackBtn")
//     ?.addEventListener("click", navigateToHome);
//   document
//     .getElementById("setViewLearnBtn")
//     ?.addEventListener("click", () =>
//       navigateToLearnMode(getState().activeSetId),
//     );
//   document
//     .getElementById("setViewAddCardBtn")
//     ?.addEventListener("click", () => showModal("addCardModal"));
//   document
//     .getElementById("setViewDeleteBtn")
//     ?.addEventListener("click", handleDeleteCurrentSet);
//   document
//     .getElementById("bulkImportBtn")
//     ?.addEventListener("click", () => showModal("bulkImportModal"));

//   document
//     .getElementById("setViewStarredBtn")
//     ?.addEventListener("click", () =>
//       navigateToLearnMode(getState().activeSetId, { mode: "starred" }),
//     );
//   document
//     .getElementById("setViewDueBtn")
//     ?.addEventListener("click", () =>
//       navigateToLearnMode(getState().activeSetId, { mode: "due" }),
//     );

//   // --- 5. ADD CARD ---
//   document
//     .getElementById("addCardForm")
//     ?.addEventListener("submit", async (e) => {
//       e.preventDefault();
//       const term = document.getElementById("addCardTermInput").value.trim();
//       const def = document.getElementById("addCardDefInput").value.trim();
//       const activeSetId = getState().activeSetId;
//       if (term && def) {
//         try {
//           const response = await fetch(
//             `https://localhost:7077/api/Flashcards`,
//             {
//               method: "POST",
//               headers: { "Content-Type": "application/json" },
//               body: JSON.stringify({
//                 term: term,
//                 definition: def,
//                 studySetId: parseInt(activeSetId),
//                 isStarred: false,
//               }),
//             },
//           );
//           if (!response.ok) return alert("Lưu thẻ thất bại!");
//           hideModal("addCardModal");
//           await fetchStudySetsFromSQL();
//           navigateToSetView(activeSetId);
//         } catch (err) {
//           alert("Lỗi kết nối Backend!");
//         }
//       }
//     });

//   // --- 6. BULK IMPORT ---
//   document
//     .getElementById("bulkImportCloseBtn")
//     ?.addEventListener("click", () => hideModal("bulkImportModal"));
//   document.getElementById("importBtn")?.addEventListener("click", async () => {
//     const rawText = document.getElementById("importText").value.trim();
//     const delimiter = document.getElementById("importDelimiter").value;
//     const activeSetId = getState().activeSetId;
//     if (!rawText) return alert("Dữ liệu trống kìa ông ơi!");

//     let cardsToImport = [];
//     const lines = rawText.split("\n").filter((l) => l.trim() !== "");

//     if (delimiter === "newline") {
//       for (let i = 0; i < lines.length; i += 2) {
//         if (lines[i] && lines[i + 1])
//           cardsToImport.push({
//             term: lines[i].trim(),
//             definition: lines[i + 1].trim(),
//           });
//       }
//     } else {
//       lines.forEach((line) => {
//         let sep = delimiter;
//         if (delimiter === "auto") {
//           if (line.includes("\t")) sep = "\t";
//           else if (line.includes(":")) sep = ":";
//           else if (line.includes(";")) sep = ";";
//           else if (line.includes(",")) sep = ",";
//           else sep = "-";
//         } else if (delimiter === "tab") sep = "\t";
//         const parts = line.split(sep);
//         if (parts.length >= 2)
//           cardsToImport.push({
//             term: parts[0].trim(),
//             definition: parts.slice(1).join(sep).trim(),
//           });
//       });
//     }

//     if (cardsToImport.length === 0)
//       return alert("Không tìm thấy dữ liệu hợp lệ!");

//     const btn = document.getElementById("importBtn");
//     btn.disabled = true;
//     btn.innerText = "Processing...";
//     let successCount = 0;
//     try {
//       for (const card of cardsToImport) {
//         const response = await fetch(`https://localhost:7077/api/Flashcards`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             term: card.term,
//             definition: card.definition,
//             studySetId: parseInt(activeSetId),
//             isStarred: false,
//           }),
//         });
//         if (response.ok) successCount++;
//       }
//       alert(
//         `Đã nạp thành công ${successCount}/${cardsToImport.length} thẻ vào SQL!`,
//       );
//       document.getElementById("importText").value = "";
//       hideModal("bulkImportModal");
//       await fetchStudySetsFromSQL();
//       navigateToSetView(activeSetId);
//     } catch (err) {
//       alert("Lỗi Backend!");
//     } finally {
//       btn.disabled = false;
//       btn.innerHTML = `<span class="material-symbols-outlined">upload</span> Import Cards`;
//     }
//   });

//   // --- 7. FLASHCARD & UI CONTROLS ---
//   document
//     .getElementById("flashcard")
//     ?.addEventListener("click", flipFlashcard);
//   document.getElementById("flashcardPrev")?.addEventListener("click", (e) => {
//     e.stopPropagation();
//     prevFlashcard();
//   });
//   document.getElementById("flashcardNext")?.addEventListener("click", (e) => {
//     e.stopPropagation();
//     nextFlashcard();
//   });

//   document
//     .getElementById("flashcardSpeakBtn")
//     ?.addEventListener("click", (e) => {
//       e.stopPropagation();
//       const set = getActiveSet();
//       if (!set || set.cards.length === 0) return;
//       const cardIndex = flashcardState.cardOrder[flashcardState.currentIndex];
//       const card = set.cards[cardIndex];
//       if (card) {
//         const textToRead = flashcardState.isFlipped
//           ? card.definition
//           : card.term;
//         handleSpeak(textToRead);
//       }
//     });

//   // --- 8. LEARN MODE CONTROLS ---
//   document
//     .getElementById("learnExitBtn")
//     ?.addEventListener("click", async () => {
//       await fetchStudySetsFromSQL();
//       navigateToHome();
//       try {
//         const { updateDashboardProgress } = await import("./render.js");
//         updateDashboardProgress();
//       } catch (e) {}
//     });

//   document
//     .getElementById("nextQuestionBtn")
//     ?.addEventListener("click", nextQuestion);
//   document
//     .getElementById("continueBtn")
//     ?.addEventListener("click", handleContinueLearning);
//   document
//     .getElementById("setViewResetBtn")
//     ?.addEventListener("click", () =>
//       handleResetProgress(getState().activeSetId),
//     );

//   // --- 9. MODALS & KEYBOARD ---
//   document
//     .querySelectorAll(".modal-overlay")
//     .forEach((overlay) => overlay.addEventListener("click", hideAllModals));
//   document.addEventListener("keydown", handleKeyboard);

//   // --- 10. SỰ KIỆN MÀN HÌNH CHÚC MỪNG ---
//   document.addEventListener("click", async (e) => {
//     if (e.target.innerText.includes("Restart Session")) {
//       await fetchStudySetsFromSQL();
//       const activeSetId = getState().activeSetId;
//       if (typeof clearLearnSessionStorage === "function")
//         clearLearnSessionStorage();
//       navigateToLearnMode(activeSetId);
//     }

//     if (e.target.innerText.includes("Back to Set")) {
//       await fetchStudySetsFromSQL();
//       navigateToHome();
//       try {
//         const { updateDashboardProgress } = await import("./render.js");
//         updateDashboardProgress();
//       } catch (err) {}
//     }
//   });
// }
// 🔥 HÀM XÓA TỪNG FLASHCARD
window.deleteSingleCard = async function(cardId) {
    // Hỏi nhẹ một câu cho chắc cú
    if (!confirm("Ê ní, có chắc là muốn xóa từ này khỏi bộ không?")) return;

    try {
        const response = await fetch(`https://localhost:7077/api/Flashcards/${cardId}`, {
            method: "DELETE"
        });

        if (response.ok) {
            // Xóa thành công thì load lại data từ SQL và render lại màn hình
            await fetchStudySetsFromSQL(); 
            const activeSetId = getState().activeSetId;
            navigateToSetView(activeSetId); // Load lại giao diện bộ từ vựng
        } else {
            alert("Lỗi: Backend C# từ chối xóa!");
        }
    } catch (err) {
        alert("Lỗi kết nối Backend! C# tắt rồi hả?");
    }
};
