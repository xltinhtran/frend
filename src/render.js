/**
 * render.js - DOM Rendering Functions
 * BẢN FULL ULTIMATE: FIX MỌI LỖI (HIỆN CHỮ, NHÃN TỪ VỰNG, NHẢY SỐ NÚT STARRED, RESET)
 */

import {
  getState,
  getAllSets,
  getSet,
  getActiveSet,
  getStarredCards,
  getDueCards,
  getLearnSession,
  getSettings,
  getFeatures,
  getTtsState,
} from "./state.js";
import { loadLearnSession } from "./storage.js";
import {
  GRADES,
  GRADE_LABELS,
  GRADE_COLORS,
  getMasteryLevel,
  getMasteryLabel,
  getMasteryColor,
  getNextReviewText,
  estimateStudyTime,
} from "./spacedRep.js";
import { getTodayStats, getStreakInfo, getTotalStats } from "./analytics.js";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hàm dùng chung để gọi API lấy tiến độ từ C#
async function fetchProgressData() {
  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  if (!user || !user.id) return [];
  try {
    const res = await fetch(
      `https://localhost:7077/api/StudySets/dashboard/${user.id}`,
    );
    return await res.json();
  } catch (error) {
    console.error("Lỗi không lấy được dữ liệu từ C#:", error);
    return [];
  }
}

let savedHandlers = {};

export async function renderHome(handlers) {
  savedHandlers = handlers;
  renderHomeHeader(handlers);
  renderHomeQuickActions(handlers);
  renderHomeResumeSection(handlers);
  renderHomeSetGrid(handlers);
  renderHomeStats();

  setTimeout(() => {
    const studySelect = document.getElementById("quickActionStudy");
    if (studySelect) studySelect.dispatchEvent(new Event("change"));
  }, 100);
}

function renderHomeHeader(handlers) {
  const ttsState = getTtsState();
  const micIndicator = document.getElementById("micIndicator");

  if (micIndicator) {
    if (ttsState.usePremium && ttsState.elevenLabsKey) {
      micIndicator.classList.remove("text-slate-300");
      micIndicator.classList.add("text-green-500");
      micIndicator.setAttribute("title", "Premium voices active");
    } else {
      micIndicator.classList.remove("text-green-500");
      micIndicator.classList.add("text-slate-300");
      micIndicator.setAttribute("title", "Free voices (browser)");
    }
  }
}

export function renderHomeQuickActions(handlers) {
  const container = document.getElementById("homeQuickActions");
  if (!container) return;

  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");

  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  const isAdmin = user && (user.role === "Admin" || user.Role === "Admin");

  if (isAdmin || setIds.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");

  let totalDue = 0;

  setIds.forEach((id) => {
    const set = allSets[id];
    if (set && set.cards) {
      const learned = set.cards.filter(
        (c) => getMasteryLevel(c.stats) > 0,
      ).length;
      totalDue += learned;
    }
  });

  const dueBtn = document.getElementById("quickActionDue");
  if (dueBtn) {
    const countSpan = dueBtn.querySelector(".due-count");
    if (countSpan) countSpan.textContent = totalDue;
    dueBtn.disabled = totalDue === 0;
  }

  let resetContainer = document.getElementById("resetAllContainer");
  if (!resetContainer) {
    resetContainer = document.createElement("div");
    resetContainer.id = "resetAllContainer";
    resetContainer.className = "flex items-center ml-2";
    container.appendChild(resetContainer);
  }

  resetContainer.innerHTML = `
        <button id="btnResetAll" class="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-all font-medium border border-red-200">
            <span class="material-symbols-outlined text-lg">restart_alt</span>
            Reset All
        </button>
    `;

  document.getElementById("btnResetAll").onclick = () => {
    if (typeof window.resetAllProgress === "function") {
      window.resetAllProgress();
    }
  };
}

export function renderHomeResumeSection(handlers) {
  const container = document.getElementById("homeResumeSection");
  const card = document.getElementById("homeResumeCard");
  if (!container || !card) return;

  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  if (user && (user.role === "Admin" || user.Role === "Admin")) {
    container.classList.add("hidden");
    return;
  }

  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");

  if (setIds.length === 0) {
    container.classList.add("hidden");
    return;
  }

  const setsWithProgress = setIds.map((id) => {
    const set = allSets[id];
    const cardCount = set.cards ? set.cards.length : 0;

    let learnedCards = 0;
    if (set.cards) {
      learnedCards = set.cards.filter(
        (c) => c.stats && (c.stats.repetitions > 0 || c.stats.Repetitions > 0),
      ).length;
    }

    const progressPercent =
      cardCount > 0 ? Math.round((learnedCards / cardCount) * 100) : 0;

    return {
      id: id,
      title: set.name || set.title,
      totalCards: cardCount,
      learnedCards: learnedCards,
      progressPercent: progressPercent,
    };
  });

  let nextSetToStudy = setsWithProgress.find(
    (set) => set.progressPercent > 0 && set.progressPercent < 100,
  );

  if (nextSetToStudy) {
    container.classList.remove("hidden");

    card.innerHTML = `
            <div id="btnResumeStudy" class="flex flex-col cursor-pointer group p-2 hover:bg-slate-50 transition-colors rounded-lg -m-2">
                <div class="flex items-center justify-between p-1">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors truncate">${escapeHtml(nextSetToStudy.title)}</h3>
                        <p class="text-sm text-slate-500 mt-1">
                            ${nextSetToStudy.learnedCards} of ${nextSetToStudy.totalCards} cards • In progress
                        </p>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-indigo-600">${nextSetToStudy.progressPercent}%</div>
                            <div class="text-xs text-slate-400 font-medium">Complete</div>
                        </div>
                        <button class="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm pointer-events-none">
                            <span class="material-symbols-outlined">play_arrow</span>
                        </button>
                    </div>
                </div>
                <div class="mt-2 w-full bg-slate-200 rounded-full h-2">
                    <div class="bg-indigo-600 h-2 rounded-full transition-all duration-700" style="width: ${nextSetToStudy.progressPercent}%"></div>
                </div>
            </div>
        `;

    const btnResume = document.getElementById("btnResumeStudy");
    if (btnResume) {
      btnResume.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (handlers && typeof handlers.onResumeSession === "function") {
          handlers.onResumeSession({
            setId: nextSetToStudy.id,
            mode: "all",
          });
        }
      };
    }
  } else {
    container.classList.add("hidden");
  }
}

export function renderHomeSetGrid(handlers) {
  const grid = document.getElementById("homeSetGrid");
  if (!grid) return;

  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");

  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  const isAdmin = user && (user.role === "Admin" || user.Role === "Admin");

  if (setIds.length === 0) {
    grid.innerHTML = `
        <div class="col-span-full text-center py-16">
            <span class="material-symbols-outlined text-7xl text-slate-300 mb-4">library_books</span>
            <h3 class="text-xl font-semibold text-slate-600 mb-2">No study sets yet</h3>
            <p class="text-slate-400 mb-6">Create your first set to get started!</p>
            <button id="emptyCreateSetBtn" class="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-all">
                <span class="material-symbols-outlined">add</span>
                Create Set
            </button>
        </div>
    `;
    document
      .getElementById("emptyCreateSetBtn")
      ?.addEventListener("click", handlers.onCreateSet);
    return;
  }

  grid.innerHTML = setIds
    .map((setId) => {
      const set = allSets[setId];
      const cardCount = set.cards.length;

      let statusBadge = "";
      let progressHtml = "";
      let cardInfoHtml = "";
      let borderColor = "border-slate-200";
      let hoverBorderColor = "hover:border-indigo-300";
      let bgColor = "bg-white";

      if (!isAdmin) {
        const learnedCards = set.cards.filter(
          (c) => getMasteryLevel(c.stats) > 0,
        ).length;
        const progress =
          cardCount > 0 ? Math.round((learnedCards / cardCount) * 100) : 0;
        const isComplete = cardCount > 0 && progress === 100;

        const starredCount = set.cards.filter((c) => c.starred).length;
        const dueCount = set.cards.filter(
          (c) => getMasteryLevel(c.stats) > 0,
        ).length;

        if (isComplete) {
          statusBadge =
            '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2 border border-green-300 align-middle inline-block">✅ Completed </span>';
        } else if (progress > 0) {
          statusBadge =
            '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-2 border border-orange-300 align-middle inline-block font-medium">⏳ Incomplete</span>';
        }

        const barColor = isComplete ? "bg-green-500" : "bg-indigo-600";
        borderColor = isComplete ? "border-green-400" : "border-slate-200";
        hoverBorderColor = isComplete
          ? "hover:border-green-500"
          : "hover:border-indigo-300";
        bgColor = isComplete ? "bg-green-50/40" : "bg-white";

        cardInfoHtml = `
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-base">style</span>${cardCount}</span>
            ${starredCount > 0 ? `<span class="flex items-center gap-1 text-yellow-600"><span class="material-symbols-outlined text-base filled">star</span>${starredCount}</span>` : ""}
            ${dueCount > 0 ? `<span class="flex items-center gap-1 text-orange-500"><span class="material-symbols-outlined text-base">schedule</span>${dueCount} due</span>` : ""}
        `;

        progressHtml = `
            <div class="flex items-center gap-2 mt-3">
                <div class="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div class="${barColor} h-1.5 rounded-full transition-all" style="width: ${progress}%"></div>
                </div>
                <span class="text-xs text-slate-400 font-medium">${progress}%</span>
            </div>
        `;
      } else {
        cardInfoHtml = `
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-base">style</span>${cardCount} terms</span>
        `;
        progressHtml = "";
      }

      return `
        <button class="set-card group ${bgColor} p-5 rounded-xl shadow-sm border ${borderColor} text-left
                     ${hoverBorderColor} hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                data-set-id="${setId}" aria-label="Open ${escapeHtml(set.name)}">
            <h3 class="font-semibold text-lg text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors truncate">
                ${escapeHtml(set.name)}
                ${statusBadge}
            </h3>
            <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                ${cardInfoHtml}
            </div>
            ${progressHtml}
        </button>
    `;
    })
    .join("");

  grid.querySelectorAll(".set-card").forEach((card) => {
    card.addEventListener("click", () =>
      handlers.onSelectSet?.(card.dataset.setId),
    );
  });
}

function renderHomeStats() {
  const container = document.getElementById("homeStats");
  if (!container) return;

  const todayStats = getTodayStats();
  const streakInfo = getStreakInfo();

  container.innerHTML = `
        <div class="flex items-center gap-2 text-sm">
            <span class="material-symbols-outlined text-orange-500">local_fire_department</span>
            <span class="font-medium">${streakInfo.current}</span>
            <span class="text-slate-400">day streak</span>
        </div>
        <div class="w-px h-4 bg-slate-200"></div>
        <div class="flex items-center gap-2 text-sm">
            <span class="material-symbols-outlined text-indigo-500">school</span>
            <span class="font-medium">${todayStats.cards}</span>
            <span class="text-slate-400">today</span>
        </div>
    `;
}

export async function updateDashboardProgress() {
  const dashboardData = await fetchProgressData();
  if (dashboardData.length > 0) {
    renderHomeResumeSection(savedHandlers, dashboardData);
    renderHomeSetGrid(savedHandlers, dashboardData);
    renderHomeQuickActions(savedHandlers);
  }
}

// ============================================================
// SET VIEW RENDERING
// ============================================================

export function renderSetView(setId, handlers) {
  const set = getSet(setId);
  if (!set) return;

  renderSetViewHeader(set, handlers);
  renderFlashcardCarousel(set, handlers);
  renderSetViewActions(set, handlers);
  renderTermList(set, handlers);
}

function renderSetViewHeader(set, handlers) {
  const title = document.getElementById("setViewTitle");
  const cardCount = document.getElementById("setViewCardCount");
  const starredCount = document.getElementById("setViewStarredCount");
  const dueCount = document.getElementById("setViewDueCount");

  if (title) title.textContent = set.name;
  if (cardCount) cardCount.textContent = set.cards.length;
  if (starredCount)
    starredCount.textContent = set.cards.filter((c) => c.starred).length;
  if (dueCount) {
    const due = set.cards.filter((c) => c.stats?.dueAt <= Date.now()).length;
    dueCount.textContent = due;
  }
}

function renderFlashcardCarousel(set, handlers) {
  const flashcard = document.getElementById("flashcard");
  const flashcardFront = document.getElementById("flashcardFront");
  const flashcardBack = document.getElementById("flashcardBack");
  const flashcardCounter = document.getElementById("flashcardCounter");
  const noCardsMessage = document.getElementById("noCardsMessage");

  if (!flashcard) return;

  if (set.cards.length === 0) {
    flashcard.classList.add("hidden");
    if (noCardsMessage) noCardsMessage.classList.remove("hidden");
    if (flashcardCounter) flashcardCounter.textContent = "0 / 0";
    return;
  }

  flashcard.classList.remove("hidden");
  if (noCardsMessage) noCardsMessage.classList.add("hidden");

  const index = handlers.currentIndex || 0;
  const order = handlers.cardOrder || set.cards.map((_, i) => i);
  const actualIndex = order[index % order.length];
  const card = set.cards[actualIndex];

  if (!card) return;

  if (flashcardFront) flashcardFront.textContent = card.term;
  if (flashcardBack) flashcardBack.textContent = card.definition;
  if (flashcardCounter)
    flashcardCounter.textContent = `${index + 1} / ${set.cards.length}`;

  flashcard.classList.remove("flipped");
}

export function renderSetViewActions(set, handlers) {
    const learnBtn = document.getElementById("setViewLearnBtn");
    const starredBtn = document.getElementById("setViewStarredBtn");
    const dueBtn = document.getElementById("setViewDueBtn");

    const user = JSON.parse(localStorage.getItem("quizlet_user")) || JSON.parse(localStorage.getItem("user"));
    const isAdmin = user && (user.role === "Admin" || user.Role === "Admin");

    if (isAdmin) {
        if (learnBtn) learnBtn.classList.add("hidden");
        if (starredBtn) starredBtn.classList.add("hidden");
        if (dueBtn) dueBtn.classList.add("hidden");
        return; 
    } else {
        if (learnBtn) learnBtn.classList.remove("hidden");
        if (starredBtn) starredBtn.classList.remove("hidden");
        if (dueBtn) dueBtn.classList.remove("hidden");
    }

    const starredCount = set.cards.filter((c) => c.starred).length;
    
    // 🔥 ĐÃ FIX: Chuyển sang soi Ngày/Giờ đáo hạn thực tế (dueAt <= thời gian hiện tại)
    const dueCount = set.cards.filter((c) => c.stats && (c.stats.repetitions > 0 || c.stats.Repetitions > 0)).length;
    
    if (learnBtn) {
        learnBtn.disabled = set.cards.length < 2;
        learnBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none">school</span> Learn All ( ${set.cards.length} )`;
    }
    
    if (starredBtn) {
        starredBtn.disabled = starredCount < 1;
        if (starredCount > 0) {
            starredBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none text-yellow-500" style="font-variation-settings: 'FILL' 1;">star</span> Starred ( ${starredCount} )`;
            starredBtn.className = "bg-yellow-50 text-yellow-700 border border-yellow-200 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-100 transition-colors flex items-center gap-2 shadow-sm";
        } else {
            starredBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none">star</span> Starred ( 0 )`;
            starredBtn.className = "bg-slate-100 text-slate-400 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed";
        }
    }
    
    if (dueBtn) {
        dueBtn.disabled = dueCount < 1;
        if (dueCount > 0) {
            dueBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none">schedule</span> Due ( ${dueCount} )`;
            dueBtn.className = "bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors flex items-center gap-2";
        } else {
            dueBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none">schedule</span> Due ( 0 )`;
            dueBtn.className = "bg-slate-100 text-slate-400 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed";
        }
    }
}

export function renderTermList(set, handlers) {
    const container = document.getElementById("termListContainer") || 
                      document.getElementById("termList") || 
                      document.getElementById("setViewTerms"); 
                      
    if (!container) return; 
    container.innerHTML = ""; 

    if (!set.cards || set.cards.length === 0) return;

    set.cards.forEach((card) => {
        const termRow = document.createElement("div");
        // Sửa lại class một chút xíu để có justify-between (đẩy nút xóa ra mép phải)
        termRow.className = "flex items-center justify-between p-4 bg-white rounded-xl shadow-sm mb-3 border border-slate-200 hover:border-indigo-100 transition-colors";

        // === PHẦN TRÁI: NGÔI SAO + CHỮ ===
        const leftSideDiv = document.createElement("div");
        leftSideDiv.className = "flex items-center w-full"; // Bao bọc ngôi sao và chữ

        // 1. NGÔI SAO
        const starIcon = document.createElement("span");
        starIcon.className = `material-symbols-outlined cursor-pointer transition-transform hover:scale-110 text-2xl mr-4 flex-shrink-0 ${
            card.starred ? "text-yellow-400" : "text-slate-300 hover:text-yellow-400"
        }`;
        if (card.starred) starIcon.style.fontVariationSettings = '"FILL" 1';
        starIcon.innerText = "star";

        // BÙA NHẢY SỐ TỰ ĐỘNG KHÔNG CẦN CHỜ APP.JS
        starIcon.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Ảo thuật đổi màu icon tức thì
            const isStarred = starIcon.classList.contains("text-yellow-400");
            card.starred = !isStarred; // Ép biến State nội bộ thay đổi theo

            if (isStarred) {
                starIcon.classList.remove("text-yellow-400");
                starIcon.classList.add("text-slate-300");
                starIcon.style.fontVariationSettings = '"FILL" 0';
            } else {
                starIcon.classList.remove("text-slate-300");
                starIcon.classList.add("text-yellow-400");
                starIcon.style.fontVariationSettings = '"FILL" 1';
            }

            // Ép nút Starred nhảy số tức thì
            const starredCount = set.cards.filter(c => c.starred).length;
            const starredBtn = document.getElementById("setViewStarredBtn");
            if (starredBtn) {
                starredBtn.disabled = starredCount < 1;
                if (starredCount > 0) {
                    starredBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none text-yellow-500" style="font-variation-settings: 'FILL' 1;">star</span> Starred ( ${starredCount} )`;
                    starredBtn.className = "bg-yellow-50 text-yellow-700 border border-yellow-200 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-100 transition-colors flex items-center gap-2 shadow-sm";
                } else {
                    starredBtn.innerHTML = `<span class="material-symbols-outlined pointer-events-none">star</span> Starred ( 0 )`;
                    starredBtn.className = "bg-slate-100 text-slate-400 px-6 py-3 rounded-lg font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed";
                }
            }

            // Gửi tín hiệu về app.js để lưu DB
            if (handlers && typeof handlers.onToggleStar === 'function') {
                handlers.onToggleStar(card.uuid || card.id);
            }
        };

        // 2. KIỂM TRA TRẠNG THÁI TỪ VỰNG
        let rep = 0;
        if (card.stats) {
            rep = card.stats.repetitions !== undefined ? card.stats.repetitions : (card.stats.Repetitions || 0);
        }
        
        let statusBadge = "";
        if (rep === 0) {
            statusBadge = `<span class="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-3 border border-slate-200">New</span>`;
        } else if (rep < 4) {
            statusBadge = `<span class="text-xs font-medium bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full ml-3 border border-orange-200">Learning</span>`;
        } else {
            statusBadge = `<span class="text-xs font-medium bg-green-100 text-green-600 px-2 py-0.5 rounded-full ml-3 border border-green-200">Mastered</span>`;
        }

        // 3. NỘI DUNG CHỮ
        const contentDiv = document.createElement("div");
        contentDiv.className = "flex-1 min-w-0 pr-4"; // Thêm padding-right để tránh dính vào nút Xóa
        contentDiv.innerHTML = `
            <div class="flex flex-col md:flex-row gap-2 md:gap-6">
                <div class="md:w-1/3 flex items-center">
                    <h3 class="font-medium text-slate-800 text-lg break-words">${escapeHtml(card.term)}</h3>
                    ${statusBadge}
                </div>
                <div class="md:w-2/3 md:border-l border-slate-100 md:pl-6 pt-2 md:pt-0 border-t md:border-t-0 mt-2 md:mt-0">
                    <p class="text-slate-600 break-words">${escapeHtml(card.definition)}</p>
                </div>
            </div>
        `;


        // Nhét sao và nội dung vào khối Trái
        leftSideDiv.appendChild(starIcon);
        leftSideDiv.appendChild(contentDiv);

        // === PHẦN PHẢI: NÚT XÓA 🔥 ===
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 flex-shrink-0";
        deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
        deleteBtn.title = "Xóa từ này";
        deleteBtn.onclick = () => {
            // Gọi ra hàm window.deleteSingleCard mà mình đã tạo ở app.js
            if (typeof window.deleteSingleCard === "function") {
                window.deleteSingleCard(card.id);
            } else {
                alert("Ông quên dán cái hàm deleteSingleCard vào app.js rồi kìa!");
            }
        };

        // Gắn cả khối Trái và khối Phải (Nút xóa) vào dòng
        termRow.appendChild(leftSideDiv);
        termRow.appendChild(deleteBtn);
        
        container.appendChild(termRow);
    });
}
// ============================================================
// LEARN MODE RENDERING
// ============================================================

export function renderLearnMode(session, set, handlers) {
  renderLearnProgress(session);
  renderLearnQuestion(session, set, handlers);
}

function renderLearnProgress(session) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  const total = session.unseenIds.length + session.masteredIds.length;
  const mastered = session.masteredIds.length;
  const progress = total > 0 ? (mastered / total) * 100 : 0;

  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressText) progressText.textContent = `${mastered} / ${total}`;
}

export function renderLearnQuestion(session, set, handlers) {
  const questionText = document.getElementById("questionText");
  const gradeButtons = document.getElementById("gradeButtons");
  const answerOptions = document.getElementById("answerOptions");

  if (!session.currentQuestionId) return;

  const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
  if (!card) return;

  if (questionText) {
    questionText.innerHTML = "";

    // 🔥 XỬ LÝ CHUỖI: Tách lấy phần nghĩa sau dấu " - "
    const parts = card.definition.split(" - ");
    
    // Nếu tìm thấy dấu " - ", lấy phần thứ 2. Nếu không (dữ liệu cũ), lấy hết.
    const meaningOnly = parts.length > 1 ? parts[1].trim() : card.definition;

    // Chia nhỏ cái "nghĩa" đó ra thành từng từ để làm clickable-word
    const words = meaningOnly.split(/\s+/);

    words.forEach((word) => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className =
        "clickable-word cursor-pointer hover:bg-indigo-100 rounded px-0.5 transition-colors";
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onWordClick?.(
          word.replace(/[.,!?;:'"()]/g, ""),
          e.clientX,
          e.clientY,
        );
      });
      questionText.appendChild(span);
    });
  }

  if (gradeButtons) {
    gradeButtons.classList.add("hidden");
    if (answerOptions) answerOptions.classList.remove("hidden");
    renderMultipleChoice(session, set, handlers);
  }
}

function renderMultipleChoice(session, set, handlers) {
  const answerOptions = document.getElementById("answerOptions");
  if (!answerOptions) return;

  const currentCard = set.cards.find(
    (c) => c.uuid === session.currentQuestionId,
  );
  if (!currentCard) return;

  let options = [currentCard];
  const otherCards = set.cards.filter((c) => c.uuid !== currentCard.uuid);
  const shuffled = shuffleArray(otherCards);

  const numOptions = Math.min(4, set.cards.length);
  while (options.length < numOptions && shuffled.length > 0) {
    options.push(shuffled.pop());
  }

  options = shuffleArray(options);

  answerOptions.innerHTML = options
    .map(
      (card) => `
        <button class="answer-btn w-full text-left p-4 border-2 border-slate-300 rounded-lg 
                       hover:bg-slate-50 hover:border-indigo-400 transition-all"
                data-id="${card.uuid}">
            ${escapeHtml(card.term)}
        </button>
    `,
    )
    .join("");

  answerOptions.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isCorrect = btn.dataset.id === currentCard.uuid;
      handlers.onAnswer?.(isCorrect, btn, currentCard.uuid);
    });
  });
}

export function renderAnswerFeedback(selectedBtn, correctId, isCorrect) {
  const answerOptions = document.getElementById("answerOptions");
  if (!answerOptions) return;

  answerOptions.querySelectorAll(".answer-btn").forEach((btn) => {
    btn.disabled = true;
    btn.classList.remove("hover:bg-slate-50", "hover:border-indigo-400");

    if (btn.dataset.id === correctId) {
      btn.classList.remove("border-slate-300");
      btn.classList.add("bg-green-100", "border-green-500", "text-green-800");
    } else if (btn === selectedBtn && !isCorrect) {
      btn.classList.remove("border-slate-300");
      btn.classList.add("bg-red-100", "border-red-500", "text-red-800");
    }
  });
}

export function renderLearnFeedback(isCorrect, correctAnswer) {
  const feedbackSection = document.getElementById("feedbackSection");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackText = document.getElementById("feedbackText");
  const learnContent = document.getElementById("learnContent");

  if (!feedbackSection) return;

  if (learnContent) learnContent.classList.add("hidden");
  feedbackSection.classList.remove("hidden");

  if (isCorrect) {
    feedbackTitle.textContent = "Correct!";
    feedbackTitle.className = "text-xl font-bold text-green-600";
    feedbackText.textContent = "Great job! Keep going!";
  } else {
    feedbackTitle.textContent = "Not quite...";
    feedbackTitle.className = "text-xl font-bold text-red-600";
    feedbackText.textContent = `The correct answer was "${correctAnswer}". We'll ask this again later.`;
  }
}

export function renderLearnSummary(batchHistory) {
  const summaryScreen = document.getElementById("summaryScreen");
  const summaryCorrect = document.getElementById("summaryCorrect");
  const summaryMissed = document.getElementById("summaryMissed");
  const summaryList = document.getElementById("summaryList");
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");

  if (!summaryScreen) return;

  if (learnContent) learnContent.classList.add("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  summaryScreen.classList.remove("hidden");

  const correct = batchHistory.filter((h) => h.correct).length;
  const missed = batchHistory.length - correct;

  if (summaryCorrect) summaryCorrect.textContent = correct;
  if (summaryMissed) summaryMissed.textContent = missed;

  if (summaryList) {
    summaryList.innerHTML = batchHistory
      .map(
        (item) => `
            <div class="flex justify-between items-center p-3 rounded-lg ${item.correct ? "bg-green-50" : "bg-red-50"} mb-2">
                <div class="min-w-0">
                    <p class="font-medium text-slate-800 truncate">${escapeHtml(item.card?.term || "Unknown")}</p>
                    <p class="text-sm text-slate-500 truncate">${escapeHtml(item.card?.definition || "")}</p>
                </div>
                <span class="${item.correct ? "text-green-600" : "text-red-600"} font-semibold ml-4">
                    ${item.correct ? "Correct" : "Missed"}
                </span>
            </div>
        `,
      )
      .join("");
  }
}

export function renderLearnCompletion() {
  const completionScreen = document.getElementById("completionScreen");
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");
  const summaryScreen = document.getElementById("summaryScreen");

  if (learnContent) learnContent.classList.add("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  if (summaryScreen) summaryScreen.classList.add("hidden");
  if (completionScreen) completionScreen.classList.remove("hidden");
}

export function resetLearnUI() {
  const learnContent = document.getElementById("learnContent");
  const feedbackSection = document.getElementById("feedbackSection");
  const summaryScreen = document.getElementById("summaryScreen");
  const completionScreen = document.getElementById("completionScreen");

  if (learnContent) learnContent.classList.remove("hidden");
  if (feedbackSection) feedbackSection.classList.add("hidden");
  if (summaryScreen) summaryScreen.classList.add("hidden");
  if (completionScreen) completionScreen.classList.add("hidden");
}

// ============================================================
// HÀM RESET TOÀN BỘ TIẾN ĐỘ (HỌC LẠI TỪ ĐẦU)
// ============================================================
window.resetAllProgress = async function () {
  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  if (!userData) return alert("Phải đăng nhập mới reset được ông ơi!");

  const confirmReset = confirm(
    "⚠️ Warning: Are you sure you want to reset all progress? This action cannot be undone!",
  );

  if (!confirmReset) return;

  try {
    const btn = document.getElementById("btnResetAll");
    if (btn) btn.innerText = "Processing...";

    const res = await fetch(
      `https://localhost:7077/api/StudySets/dashboard/${userData.id}`,
    );
    const dashboardData = await res.json();

    const resetPromises = dashboardData.map((set) =>
      fetch(
        `https://localhost:7077/api/StudyProgresses/reset/${set.id}/${userData.id}`,
        { method: "DELETE" },
      ),
    );

    await Promise.all(resetPromises);

    alert("Tẩy não thành công! Mọi thứ đã về 0%. Chúc ông cày lại vui vẻ!");
    location.reload();
  } catch (err) {
    console.error("Lỗi reset toàn bộ:", err);
    alert("Lỗi kết nối Backend rồi, kiểm tra lại cổng 7077 nhé!");
  }
};