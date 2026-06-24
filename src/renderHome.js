// renderHome.js
import { getAllSets, getTtsState } from "./state.js";
import { getMasteryLevel } from "./spacedRep.js";
import { getTodayStats, getStreakInfo } from "./analytics.js";
import { escapeHtml } from "./renderUtils.js";
import {
  deleteStudySet,
  fetchStudySetsFromSQL,
  getDashboardStudySets,
  getDashboardStudySetsResponse,
  resetStudyProgress,
  updateStudySet,
} from "./api.js";

async function fetchProgressData() {
  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  if (!user || !user.id) return [];
  try {
    return await getDashboardStudySets(user.id);
  } catch (error) {
    console.error("Lỗi không lấy được dữ liệu từ C#:", error);
    return [];
  }
}

let savedHandlers = {};
let currentEditorView = "dashboard";

function getCurrentUser() {
  return (
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"))
  );
}

function getCurrentRole() {
  const user = getCurrentUser();
  return (user?.role || user?.Role || "").trim().toLowerCase();
}

function isEditorRole() {
  return getCurrentRole() === "editor";
}

function setEditorSidebarActive(action) {
  document.querySelectorAll(".editor-sidebar-btn").forEach((btn) => {
    const isActive = btn.dataset.editorAction === action;
    btn.classList.toggle("bg-indigo-50", isActive);
    btn.classList.toggle("text-indigo-700", isActive);
    btn.classList.toggle("font-bold", isActive);
    btn.classList.toggle("text-slate-600", !isActive);
  });
}

function showAllEditorSetCards() {
  document.getElementById("editorEmptyState")?.remove();
  document.querySelectorAll(".set-card").forEach((card) => {
    card.classList.remove("hidden");
    card.style.display = "";
  });
}

function setEditorView(view) {
  currentEditorView = view;
  const overview = document.getElementById("editorOverview");
  const quickActions = document.getElementById("homeQuickActions");
  const listTitle = document.getElementById("homeSetListTitle");
  const listPanel = listTitle?.parentElement;
  const grid = document.getElementById("homeSetGrid");
  const show = (element) => {
    if (!element) return;
    element.classList.remove("hidden");
    element.style.display = "";
  };
  const hide = (element) => {
    if (!element) return;
    element.classList.add("hidden");
    element.style.display = "none";
  };

  if (view === "dashboard") {
    show(overview);
    hide(quickActions);
    hide(listPanel);
    return;
  }

  if (view === "sets") {
    hide(overview);
    show(quickActions);
    show(listPanel);
    if (listTitle) {
      listTitle.innerHTML = `
        <span class="flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-600">inventory_2</span>
          Danh sách bộ từ vựng
        </span>
        <button id="editorCreateSetInlineBtn" type="button" class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          <span class="material-symbols-outlined text-base">add</span>
          Tạo bộ từ
        </button>
      `;
      listTitle.classList.add("justify-between");
      document.getElementById("editorCreateSetInlineBtn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        document.getElementById("createSetModal")?.classList.remove("hidden");
      });
    }
    showAllEditorSetCards();
    return;
  }

  if (view === "need-review") {
    hide(overview);
    hide(quickActions);
    show(listPanel);
    if (listTitle) {
      listTitle.innerHTML = `<span class="material-symbols-outlined text-indigo-600">rule</span> Bộ từ cần rà soát`;
      listTitle.classList.remove("justify-between");
    }
    return;
  }
}

async function handleEditorDeleteSet(setId, title) {
  if (!confirm(`Xóa bộ từ "${title}"? Toàn bộ thẻ trong bộ này cũng sẽ bị xóa.`)) return;

  try {
    const response = await deleteStudySet(setId);
    if (!response.ok) {
      alert("Không xóa được bộ từ. Kiểm tra lại backend.");
      return;
    }

    if (window.logSystemActivity) {
      window.logSystemActivity(`vừa xóa bộ từ "${title}".`, "delete_forever", "text-red-600", "bg-red-100");
    }

    await fetchStudySetsFromSQL();
    currentEditorView = "sets";
    await window.navigateToHome?.();
  } catch (error) {
    console.error(error);
    alert("Lỗi kết nối backend khi xóa bộ từ.");
  }
}

async function handleEditorRenameSet(setId, set) {
  const currentTitle = set?.name || set?.title || "";
  const nextTitle = prompt("Nhập tên mới cho bộ từ:", currentTitle)?.trim();
  if (!nextTitle || nextTitle === currentTitle) return;

  const user = getCurrentUser();
  const payload = {
    id: Number(setId),
    title: nextTitle,
    description: set?.description || "",
    isPublic: true,
    userId: user?.id || user?.Id || 1,
  };

  try {
    const response = await updateStudySet(setId, payload);
    if (!response.ok) {
      alert("Backend chưa hỗ trợ sửa tên bộ từ hoặc lưu thất bại.");
      return;
    }

    if (window.logSystemActivity) {
      window.logSystemActivity(`vừa đổi tên bộ từ "${currentTitle}" thành "${nextTitle}".`, "edit_note", "text-amber-500", "bg-amber-100");
    }

    await fetchStudySetsFromSQL();
    currentEditorView = "sets";
    await window.navigateToHome?.();
  } catch (error) {
    console.error(error);
    alert("Lỗi kết nối backend khi sửa bộ từ.");
  }
}

function enhanceEditorOverview(overview, data) {
  if (!overview) return;

  overview.className = "mb-8 space-y-6";

  const header = overview.firstElementChild;
  if (header) {
    header.className = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between";
  }

  const metricGrid = header?.nextElementSibling;
  if (metricGrid) {
    metricGrid.className = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
    const themes = [
      ["border-indigo-100", "bg-indigo-50"],
      ["border-sky-100", "bg-sky-50"],
      ["border-emerald-100", "bg-emerald-50"],
      ["border-amber-200", "bg-amber-50"],
    ];
    Array.from(metricGrid.children).forEach((card, index) => {
      card.className = `rounded-2xl border ${themes[index]?.[0] || "border-slate-200"} ${themes[index]?.[1] || "bg-white"} p-5 shadow-sm`;
    });
  }

  const oldLibraryPanel = metricGrid?.nextElementSibling;
  if (oldLibraryPanel) oldLibraryPanel.classList.add("hidden");

  const qualityPanel = document.createElement("section");
  qualityPanel.className = "grid grid-cols-1 gap-4";
  qualityPanel.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-extrabold text-slate-950">Chất lượng nội dung</h3>
          <p class="mt-1 text-sm text-slate-500">Theo dõi nhanh mức độ đầy đủ của ví dụ và hình ảnh minh họa.</p>
        </div>
        <button id="editorOpenSetsPolishedBtn" class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          Mở bộ từ
        </button>
      </div>
      <div class="mt-6 space-y-5">
        <div>
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="font-bold text-slate-700">Ví dụ đã hoàn thiện</span>
            <span class="font-extrabold text-indigo-600">${data.completionPercent}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-100">
            <div class="h-3 rounded-full bg-indigo-600" style="width: ${data.completionPercent}%"></div>
          </div>
        </div>
        <div>
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="font-bold text-slate-700">Thẻ có hình ảnh</span>
            <span class="font-extrabold text-sky-600">${data.imagePercent}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-100">
            <div class="h-3 rounded-full bg-sky-500" style="width: ${data.imagePercent}%"></div>
          </div>
        </div>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-extrabold uppercase text-slate-400">Hoàn thiện</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-950">${data.completionPercent}%</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-extrabold uppercase text-slate-400">Có hình ảnh</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-950">${data.totalImages}</p>
        </div>
        <div class="rounded-xl bg-slate-50 p-4">
          <p class="text-xs font-extrabold uppercase text-slate-400">Cần bổ sung</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-950">${data.missingExamples}</p>
        </div>
      </div>
    </div>
  `;

  overview.appendChild(qualityPanel);
}

function renderEditorSetCards(handlers = savedHandlers) {
  const grid = document.getElementById("homeSetGrid");
  if (!grid || !isEditorRole()) return;

  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");

  if (setIds.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <span class="material-symbols-outlined mb-3 text-5xl text-slate-300">inventory_2</span>
        <h3 class="text-lg font-extrabold text-slate-800">Chưa có bộ từ nào</h3>
        <p class="mt-2 text-sm text-slate-500">Hãy tạo bộ từ đầu tiên để bắt đầu quản lý nội dung.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = setIds
    .map((setId) => {
      const set = allSets[setId];
      const cards = set.cards || [];
      const cardCount = cards.length;
      const exampleCount = cards.filter((card) => card.example || card.Example).length;
      const imageCount = cards.filter((card) => card.imageUrl || card.ImageUrl).length;
      const completePercent = cardCount > 0 ? Math.round((exampleCount / cardCount) * 100) : 0;
      const level = getSetLevel(set.name || set.title);
      const editorReady = completePercent === 100;

      return `
        <div class="set-card group bg-white p-5 rounded-lg shadow-sm border border-slate-200 text-left hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer"
                data-set-id="${setId}"
                data-editor-ready="${editorReady ? "true" : "false"}"
                role="button"
                tabindex="0"
                aria-label="Open ${escapeHtml(set.name || set.title)}">
          <h3 class="font-semibold text-lg text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors truncate">
            ${escapeHtml(set.name || set.title)}
          </h3>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">${level}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-base">style</span>${cardCount} từ</span>
            <span class="flex items-center gap-1 text-emerald-600"><span class="material-symbols-outlined text-base">fact_check</span>${exampleCount} ví dụ</span>
            <span class="flex items-center gap-1 text-sky-600"><span class="material-symbols-outlined text-base">image</span>${imageCount} ảnh</span>
          </div>
          <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span class="material-symbols-outlined text-base text-indigo-500">edit_note</span>
              Quản lý nội dung
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">${completePercent}% hoàn thiện</span>
              <button type="button" class="editor-set-edit-btn rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Sửa bộ từ" aria-label="Sửa bộ từ">
                <span class="material-symbols-outlined text-lg">edit</span>
              </button>
              <button type="button" class="editor-set-delete-btn rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Xóa bộ từ" aria-label="Xóa bộ từ">
                <span class="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll(".set-card").forEach((card) => {
    card.classList.remove("hidden");
    card.style.display = "";
    const setId = card.dataset.setId;
    const set = allSets[setId];
    const title = set?.name || set?.title || "bộ từ";

    card.querySelector(".editor-set-edit-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleEditorRenameSet(setId, set);
    });

    card.querySelector(".editor-set-delete-btn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handleEditorDeleteSet(setId, title);
    });

    card.addEventListener("click", () => handlers.onSelectSet?.(setId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlers.onSelectSet?.(setId);
      }
    });
  });
}

function getSetLevel(setName = "") {
  const match = String(setName).match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  return match ? match[1].toUpperCase() : "N/A";
}

function getLearnerInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HV";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function getLevelRank(level) {
  return ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(level);
}

function buildLearnerProgressSummary() {
  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");
  const summary = {
    totalCards: 0,
    learnedCards: 0,
    masteredCards: 0,
    learningCards: 0,
    remainingCards: 0,
    currentLevel: "N/A",
    unfinishedTopics: [],
  };

  let highestTouchedRank = -1;
  let lowestSetLevel = "N/A";

  setIds.forEach((setId) => {
    const set = allSets[setId];
    const cards = set?.cards || [];
    const title = set?.name || set?.title || "Chủ đề chưa đặt tên";
    const level = getSetLevel(title);
    const levelRank = getLevelRank(level);
    if (levelRank >= 0 && (lowestSetLevel === "N/A" || levelRank < getLevelRank(lowestSetLevel))) {
      lowestSetLevel = level;
    }

    let learnedInSet = 0;
    cards.forEach((card) => {
      const mastery = getMasteryLevel(card.stats);
      summary.totalCards += 1;

      if (mastery > 0) {
        summary.learnedCards += 1;
        learnedInSet += 1;
        if (levelRank > highestTouchedRank) highestTouchedRank = levelRank;
      }

      if (mastery >= 5) {
        summary.masteredCards += 1;
      } else if (mastery > 0) {
        summary.learningCards += 1;
      } else {
        summary.remainingCards += 1;
      }
    });

    const progress = cards.length > 0 ? Math.round((learnedInSet / cards.length) * 100) : 0;
    if (cards.length > 0 && progress < 100) {
      summary.unfinishedTopics.push({
        title,
        learned: learnedInSet,
        total: cards.length,
        progress,
      });
    }
  });

  if (highestTouchedRank >= 0) {
    summary.currentLevel = ["A1", "A2", "B1", "B2", "C1", "C2"][highestTouchedRank];
  } else {
    summary.currentLevel = lowestSetLevel;
  }

  return summary;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function renderLearnerProfileButton() {
  const button = document.getElementById("learnerProfileBtn");
  if (!button) return;

  const user = getCurrentUser();
  const role = getCurrentRole();
  const isLearner = user && role !== "admin" && role !== "editor";

  if (!isLearner) {
    button.classList.add("hidden");
    button.classList.remove("flex");
    return;
  }

  const username = user.username || user.Username || "Học viên";
  const summary = buildLearnerProgressSummary();

  button.classList.remove("hidden");
  button.classList.add("flex");
  setText("learnerProfileAvatar", getLearnerInitials(username));
  setText("learnerProfileName", username);
  setText("learnerProfileLevel", `Cấp độ ${summary.currentLevel}`);
  button.onclick = showLearnerProgressModal;
}

function renderListItems(items, emptyText, itemRenderer) {
  if (!items || items.length === 0) return `<p class="text-slate-400">${escapeHtml(emptyText)}</p>`;
  return `<ul class="space-y-1">${items.map(itemRenderer).join("")}</ul>`;
}

function showLearnerProgressModal() {
  const user = getCurrentUser();
  const username = user?.username || user?.Username || "Học viên";
  const summary = buildLearnerProgressSummary();
  const modal = document.getElementById("progressModal");
  if (!modal) return;

  setText("progressUserName", `Tiến độ của: ${username}`);
  setText("progLevel", summary.currentLevel);
  setText("progMastered", `${summary.learnedCards} từ`);
  setText("progLearning", `${summary.learningCards} từ`);
  setText("progRemaining", `${summary.remainingCards} từ`);
  setText("progTotal", `${summary.totalCards} từ`);

  const topicsEl = document.getElementById("progUnfinishedTopics");
  if (topicsEl) {
    topicsEl.innerHTML = renderListItems(
      summary.unfinishedTopics.slice(0, 12),
      "Tất cả chủ đề đã hoàn thành.",
      (topic) => `
        <li>
          <div class="flex justify-between gap-3">
            <span class="truncate">${escapeHtml(topic.title)}</span>
            <span class="shrink-0 font-bold">${topic.progress}%</span>
          </div>
          <div class="text-xs text-orange-500">${topic.learned}/${topic.total} từ đã học</div>
        </li>
      `,
    );
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

export async function renderHome(handlers) {
  savedHandlers = handlers;
  renderHomeHeader(handlers);
  renderHomeQuickActions(handlers);
  renderHomeResumeSection(handlers);
  renderHomeSetGrid(handlers);
  renderHomeStats();
  renderLearnerProfileButton();
  renderEditorHome();

  setTimeout(() => {
    const studySelect = document.getElementById("quickActionStudy");
    if (studySelect && !isEditorRole()) studySelect.dispatchEvent(new Event("change"));
    renderLearnerProfileButton();
    renderEditorHome();
  }, 100);
}

function renderHomeHeader(handlers) {
  const ttsState = getTtsState();
  const micIndicator = document.getElementById("micIndicator");
  const title = document.getElementById("homeTitle");
  const subtitle = document.getElementById("homeSubtitle");

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

  if (isEditorRole()) {
    if (title) title.textContent = "Không gian Biên tập";
    if (subtitle) subtitle.textContent = "Quản lý bộ từ vựng TOEIC, câu ví dụ và hình ảnh minh họa";
    if (micIndicator) micIndicator.classList.add("hidden");
    renderLearnerProfileButton();
    document.body.classList.add("editor-shell-active");
  } else {
    if (title) title.textContent = "StudySet";
    if (subtitle) subtitle.textContent = "Master your flashcards";
    if (micIndicator) micIndicator.classList.remove("hidden");
    renderLearnerProfileButton();
    document.body.classList.remove("editor-shell-active");
    document.getElementById("editorSidebar")?.remove();
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
  const isEditor = isEditorRole();

  if (isAdmin || setIds.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");

  if (isEditor) {
    container.className = "flex flex-col md:flex-row gap-3 mb-8 items-stretch md:items-center w-full";
    const studySelect = document.getElementById("quickActionStudy");
    const searchContainer = document.getElementById("editorSearchContainer");
    const dueBtn = document.getElementById("quickActionDue");
    const randomBtn = document.getElementById("quickActionRandom");

      if (studySelect) {
        studySelect.className = "bg-white text-slate-700 font-semibold py-3 px-4 rounded-lg outline-none cursor-pointer border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm";
      studySelect.options[0].textContent = "Tất cả cấp độ";
      studySelect.options[1].textContent = "A1 - A2";
      studySelect.options[2].textContent = "B1 - B2";
      studySelect.options[3].textContent = "C1 - C2";
    }
    if (searchContainer) searchContainer.classList.remove("hidden");
    if (dueBtn) dueBtn.classList.add("hidden");
    if (randomBtn) randomBtn.classList.add("hidden");

    document.getElementById("resetAllContainer")?.classList.add("hidden");
    return;
  }

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

function renderEditorHome() {
  const oldOverview = document.getElementById("editorOverview");
  if (oldOverview) oldOverview.remove();

  const listTitle = document.getElementById("homeSetListTitle");
  const studyArea = document.getElementById("studyArea");
  if (!studyArea) return;

  if (!isEditorRole()) {
    if (listTitle) {
      listTitle.innerHTML = `<span class="material-symbols-outlined text-indigo-600">library_books</span> Your Study Sets`;
    }
    document.body.classList.remove("editor-shell-active");
    document.getElementById("editorSidebar")?.remove();
    return;
  }

  renderEditorSidebar();

  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter((id) => id !== "review_all_fake");
  const sets = setIds.map((id) => allSets[id]);
  const totalCards = sets.reduce((sum, set) => sum + (set.cards?.length || 0), 0);
  const totalExamples = sets.reduce(
    (sum, set) => sum + (set.cards || []).filter((card) => card.example || card.Example).length,
    0,
  );
  const totalImages = sets.reduce(
    (sum, set) => sum + (set.cards || []).filter((card) => card.imageUrl || card.ImageUrl).length,
    0,
  );
  const missingExamples = Math.max(totalCards - totalExamples, 0);
  const completionPercent = totalCards > 0 ? Math.round((totalExamples / totalCards) * 100) : 0;
  const imagePercent = totalCards > 0 ? Math.round((totalImages / totalCards) * 100) : 0;

  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levelSummary = levels
    .map((level) => {
      const count = sets.filter((set) => getSetLevel(set.name || set.title) === level).length;
      return `<span class="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">${level}: ${count}</span>`;
    })
    .join("");

  const overview = document.createElement("div");
  overview.id = "editorOverview";
  overview.className = "mb-8";
  overview.innerHTML = `
    <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-indigo-600">Tổng quan biên tập</p>
        <h2 class="text-2xl font-extrabold text-slate-900">Bảng điều khiển nội dung</h2>
        <p class="mt-1 text-sm text-slate-500">Xem nhanh số liệu thư viện, tình trạng ví dụ và mức độ hoàn thiện dữ liệu.</p>
      </div>
      <div class="flex flex-wrap gap-2">${levelSummary}</div>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase text-slate-400">Bộ từ</span>
          <span class="material-symbols-outlined text-indigo-500">folder_copy</span>
        </div>
        <p class="mt-2 text-3xl font-extrabold text-slate-900">${setIds.length}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase text-slate-400">Từ vựng</span>
          <span class="material-symbols-outlined text-sky-500">style</span>
        </div>
        <p class="mt-2 text-3xl font-extrabold text-slate-900">${totalCards}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase text-slate-400">Có ví dụ</span>
          <span class="material-symbols-outlined text-emerald-500">fact_check</span>
        </div>
        <p class="mt-2 text-3xl font-extrabold text-slate-900">${totalExamples}</p>
      </div>
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase text-amber-700">Thiếu ví dụ</span>
          <span class="material-symbols-outlined text-amber-600">edit_note</span>
        </div>
        <p class="mt-2 text-3xl font-extrabold text-amber-700">${missingExamples}</p>
      </div>
    </div>
    <div class="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-extrabold text-slate-900">Tình trạng thư viện</h3>
          <p class="text-sm text-slate-500">Tóm tắt nhanh để biên tập viên theo dõi chất lượng dữ liệu.</p>
        </div>
        <button id="editorOpenSetsBtn" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          Mở danh sách bộ từ
        </button>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="rounded-lg bg-slate-50 p-4">
          <p class="text-xs font-bold uppercase text-slate-400">Mức độ hoàn thiện</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${totalCards > 0 ? Math.round((totalExamples / totalCards) * 100) : 0}%</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-4">
          <p class="text-xs font-bold uppercase text-slate-400">Từ có hình ảnh</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${totalImages}</p>
        </div>
        <div class="rounded-lg bg-slate-50 p-4">
          <p class="text-xs font-bold uppercase text-slate-400">Cần bổ sung</p>
          <p class="mt-1 text-2xl font-extrabold text-slate-900">${missingExamples}</p>
        </div>
      </div>
    </div>
  `;

  studyArea.insertBefore(overview, studyArea.firstElementChild);
  enhanceEditorOverview(overview, { completionPercent, imagePercent, totalImages, missingExamples });
  document.getElementById("editorOpenSetsBtn")?.addEventListener("click", () => handleEditorSidebarAction("sets"));
  document.getElementById("editorOpenSetsPolishedBtn")?.addEventListener("click", () => handleEditorSidebarAction("sets"));

  if (listTitle) {
    listTitle.innerHTML = `<span class="material-symbols-outlined text-indigo-600">inventory_2</span> Danh sách bộ từ đang quản lý`;
  }

  renderEditorSetCards();
  setEditorView(currentEditorView || "dashboard");
}

window.renderEditorShell = renderEditorHome;

function renderEditorSidebar() {
  let sidebar = document.getElementById("editorSidebar");
  const user = getCurrentUser();
  const username = user?.username || user?.Username || "Editor";

  if (!sidebar) {
    sidebar = document.createElement("aside");
    sidebar.id = "editorSidebar";
    document.body.appendChild(sidebar);
  }

  sidebar.className = "editor-sidebar";
  sidebar.innerHTML = `
    <div class="flex h-16 items-center border-b border-slate-100 px-5">
      <div>
        <div class="text-xl font-extrabold text-indigo-600">Biên tập StudySet</div>
        <div class="text-xs font-medium text-slate-400">Không gian nội dung TOEIC</div>
      </div>
    </div>
    <nav class="flex-1 space-y-1 p-4">
      <button type="button" data-editor-action="dashboard" class="editor-sidebar-btn flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50">
        <span class="material-symbols-outlined text-xl">dashboard</span>
        Tổng quan
      </button>
      <button type="button" data-editor-action="sets" class="editor-sidebar-btn flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50">
        <span class="material-symbols-outlined text-xl">inventory_2</span>
        Bộ từ vựng
      </button>
      <button type="button" data-editor-action="need-review" class="editor-sidebar-btn flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50">
        <span class="material-symbols-outlined text-xl">rule</span>
        Cần rà soát
      </button>
    </nav>
    <div class="border-t border-slate-100 p-4">
      <div class="mb-3 rounded-lg bg-slate-50 p-3">
        <div class="text-sm font-bold text-slate-800">${escapeHtml(username)}</div>
        <div class="text-xs font-medium text-indigo-600">Biên tập viên</div>
      </div>
      <button type="button" data-editor-action="logout" class="editor-sidebar-btn flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-red-500 transition-colors hover:bg-red-50">
        <span class="material-symbols-outlined text-xl">logout</span>
        Đăng xuất
      </button>
    </div>
  `;

  sidebar.onclick = (event) => {
    const btn = event.target.closest("[data-editor-action]");
    if (!btn) return;
    handleEditorSidebarAction(btn.dataset.editorAction);
  };

  setEditorSidebarActive(currentEditorView || "dashboard");
}

async function handleEditorSidebarAction(action) {
  const navigatesToEditorHome = ["dashboard", "sets", "need-review"].includes(action);
  const homeSection = document.getElementById("homeSection");
  const isHomeVisible = homeSection && !homeSection.classList.contains("hidden");

  if (navigatesToEditorHome && !isHomeVisible && typeof window.navigateToHome === "function") {
    currentEditorView = action;
    await window.navigateToHome();

    return;
  }

  const grid = document.getElementById("homeSetGrid");
  const cards = Array.from(grid?.querySelectorAll(".set-card") || []);
  const clearEmptyState = () => document.getElementById("editorEmptyState")?.remove();

  if (action === "dashboard") {
    setEditorSidebarActive("dashboard");
    clearEmptyState();
    showAllEditorSetCards();
    setEditorView("dashboard");
    return;
  }

  if (action === "sets") {
    setEditorSidebarActive("sets");
    clearEmptyState();
    showAllEditorSetCards();
    setEditorView("sets");
    return;
  }

  if (action === "need-review") {
    setEditorSidebarActive("need-review");
    clearEmptyState();
    setEditorView("need-review");
    let visibleCount = 0;
    cards.forEach((card) => {
      const shouldHide = card.dataset.editorReady === "true";
      card.classList.toggle("hidden", shouldHide);
      card.style.display = shouldHide ? "none" : "";
      if (!shouldHide) visibleCount++;
    });

    if (grid && visibleCount === 0) {
      const empty = document.createElement("div");
      empty.id = "editorEmptyState";
      empty.className = "col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center";
      empty.innerHTML = `
        <span class="material-symbols-outlined mb-3 text-5xl text-emerald-500">task_alt</span>
        <h3 class="text-lg font-extrabold text-slate-800">Không có bộ từ nào cần rà soát</h3>
        <p class="mt-2 text-sm text-slate-500">Tất cả bộ từ hiện đã có đủ ví dụ theo tiêu chí kiểm tra.</p>
        <button id="editorShowAllBtn" class="mt-5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700">
          Xem tất cả bộ từ
        </button>
      `;
      grid.appendChild(empty);
      document.getElementById("editorShowAllBtn")?.addEventListener("click", () => handleEditorSidebarAction("sets"));
    }

    return;
  }

  if (action === "logout") {
    localStorage.removeItem("quizlet_user");
    location.reload();
  }
}

export function renderHomeResumeSection(handlers) {
  const container = document.getElementById("homeResumeSection");
  const card = document.getElementById("homeResumeCard");
  if (!container || !card) return;

  const user =
    JSON.parse(localStorage.getItem("quizlet_user")) ||
    JSON.parse(localStorage.getItem("user"));
  if (user && (user.role === "Admin" || user.Role === "Admin" || (user.role || user.Role || "").toLowerCase() === "editor")) {
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
  const isEditor = user && ((user.role || user.Role || "").toLowerCase() === "editor");

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

      if (!isAdmin && !isEditor) {
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
      } else if (isEditor) {
        const exampleCount = set.cards.filter((card) => card.example || card.Example).length;
        const imageCount = set.cards.filter((card) => card.imageUrl || card.ImageUrl).length;
        const level = getSetLevel(set.name || set.title);
        const completePercent = cardCount > 0 ? Math.round((exampleCount / cardCount) * 100) : 0;
        const editorReady = completePercent === 100;

        borderColor = "border-slate-200";
        hoverBorderColor = "hover:border-indigo-300";
        bgColor = "bg-white";
        cardInfoHtml = `
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">${level}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-base">style</span>${cardCount} từ</span>
            <span class="flex items-center gap-1 text-emerald-600"><span class="material-symbols-outlined text-base">fact_check</span>${exampleCount} ví dụ</span>
            <span class="flex items-center gap-1 text-sky-600"><span class="material-symbols-outlined text-base">image</span>${imageCount} ảnh</span>
        `;
        progressHtml = `
            <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div class="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span class="material-symbols-outlined text-base text-indigo-500">edit_note</span>
                    Quản lý nội dung
                </div>
                <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">${completePercent}% hoàn thiện</span>
            </div>
        `;
      } else {
        cardInfoHtml = `
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-base">style</span>${cardCount} từ</span>
        `;
        progressHtml = "";
      }

      return `
        <button class="set-card group ${bgColor} p-5 rounded-lg shadow-sm border ${borderColor} text-left
                     ${hoverBorderColor} hover:shadow-md transition-all duration-200"
                data-set-id="${setId}" ${isEditor ? `data-editor-ready="${editorReady ? "true" : "false"}"` : ""} aria-label="Open ${escapeHtml(set.name)}">
            <h3 class="font-semibold text-lg text-slate-800 mb-3 group-hover:text-indigo-600 transition-colors truncate">
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
    card.classList.remove("hidden");
    card.style.display = "";
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
    "⚠️ CẢNH BÁO: Xóa sạch toàn bộ tiến độ học (cả trên Server lẫn máy). Chắc chắn không?"
  );

  if (!confirmReset) return;

  try {
    const btn = document.getElementById("btnResetAll");
    if (btn) btn.innerText = "Processing...";

    const res = await getDashboardStudySetsResponse(userData.id);
    const dashboardData = await res.json();

    const resetPromises = dashboardData.map((set) =>
      resetStudyProgress(set.id, userData.id)
    );
    await Promise.all(resetPromises);

    // 🔥 BOM NGUYÊN TỬ CHO RESET ALL 🔥
    const savedUser = localStorage.getItem("quizlet_user"); // Cất tài khoản
    
    localStorage.clear(); // Quét sạch sành sanh mọi vết tích
    sessionStorage.clear();
    
    if (savedUser) localStorage.setItem("quizlet_user", savedUser); // Trả tài khoản về

    alert("Tẩy não thành công 100%! Mọi thứ đã về 0%.");
    location.reload();
  } catch (err) {
    console.error("Lỗi khi Reset All:", err);
    alert("Có lỗi xảy ra khi tẩy não, vui lòng thử lại!");
  }
};
