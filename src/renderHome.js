// renderHome.js
import { getAllSets, getTtsState } from "./state.js";
import { getMasteryLevel } from "./spacedRep.js";
import { getTodayStats, getStreakInfo } from "./analytics.js";
import { escapeHtml } from "./renderUtils.js";

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