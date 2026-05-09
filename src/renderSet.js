// renderSet.js
import { getSet } from "./state.js";
import { escapeHtml } from "./renderUtils.js";

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

  const imgUrl = card.imageUrl || card.ImageUrl || "";

  if (flashcardFront) {
      if (imgUrl !== "") {
          flashcardFront.innerHTML = `
              <div class="flex flex-col items-center justify-center gap-2 h-full w-full">
                  <img src="${imgUrl}" alt="Lỗi tải ảnh!" class="w-32 h-32 object-cover rounded-xl shadow-sm border border-slate-200">
                  <div class="text-3xl font-bold">${escapeHtml(card.term)}</div>
              </div>
          `;
      } else {
          flashcardFront.innerHTML = `<div class="text-3xl font-bold h-full flex items-center justify-center">${escapeHtml(card.term)}</div>`;
      }
  }

  // 🔥 ĐÃ FIX CHUẨN CÂU VÍ DỤ: GOM HOA VÀ THƯỜNG
  if (flashcardBack) {
      const exampleText = card.example || card.Example || "";

      flashcardBack.innerHTML = `
          <div class="flex flex-col items-center justify-center gap-4 h-full px-6 text-center w-full">
              <div class="text-3xl font-bold text-slate-800">${escapeHtml(card.definition)}</div>
              ${exampleText !== "" ? `
              <div class="text-lg italic text-indigo-600 bg-indigo-50 p-4 rounded-xl border-l-4 border-indigo-500 w-full max-w-md shadow-sm">
                  " ${escapeHtml(exampleText)} "
              </div>` : ''}
          </div>
      `;
  }
  
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
        termRow.className = "flex items-center justify-between p-4 bg-white rounded-xl shadow-sm mb-3 border border-slate-200 hover:border-indigo-100 transition-colors";

        const leftSideDiv = document.createElement("div");
        leftSideDiv.className = "flex items-center w-full"; 

        const starIcon = document.createElement("span");
        starIcon.className = `material-symbols-outlined cursor-pointer transition-transform hover:scale-110 text-2xl mr-4 flex-shrink-0 ${
            card.starred ? "text-yellow-400" : "text-slate-300 hover:text-yellow-400"
        }`;
        if (card.starred) starIcon.style.fontVariationSettings = '"FILL" 1';
        starIcon.innerText = "star";

        starIcon.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isStarred = starIcon.classList.contains("text-yellow-400");
            card.starred = !isStarred; 

            if (isStarred) {
                starIcon.classList.remove("text-yellow-400");
                starIcon.classList.add("text-slate-300");
                starIcon.style.fontVariationSettings = '"FILL" 0';
            } else {
                starIcon.classList.remove("text-slate-300");
                starIcon.classList.add("text-yellow-400");
                starIcon.style.fontVariationSettings = '"FILL" 1';
            }

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

            if (handlers && typeof handlers.onToggleStar === 'function') {
                handlers.onToggleStar(card.uuid || card.id);
            }
        };

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

        const imgUrl = card.imageUrl || card.ImageUrl || "";
        const imgThumbnailHtml = imgUrl !== "" 
            ? `<img src="${imgUrl}" class="w-12 h-12 object-cover rounded-md border border-slate-200 flex-shrink-0 mr-4" alt="img">` 
            : `<div class="w-12 h-12 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 flex-shrink-0 mr-4"><span class="material-symbols-outlined text-xl">image</span></div>`;

        // 🔥 NÂNG CẤP MẠNH CỦA TUI: HIỂN THỊ CÂU VÍ DỤ XUỐNG CẢ DANH SÁCH TỪ BÊN DƯỚI CHO ĐỒNG BỘ
        const exampleText = card.example || card.Example || "";
        const exampleHtml = exampleText !== "" ? `<p class="text-sm italic text-indigo-500 mt-2 bg-indigo-50/50 inline-block px-2 py-1 rounded">" ${escapeHtml(exampleText)} "</p>` : "";

        const contentDiv = document.createElement("div");
        contentDiv.className = "flex-1 min-w-0 pr-4 flex items-center"; 
        contentDiv.innerHTML = `
            ${imgThumbnailHtml}
            <div class="flex-1 flex flex-col md:flex-row gap-2 md:gap-6 w-full">
                <div class="md:w-1/3 flex items-center">
                    <h3 class="font-medium text-slate-800 text-lg break-words">${escapeHtml(card.term)}</h3>
                    ${statusBadge}
                </div>
                <div class="md:w-2/3 md:border-l border-slate-100 md:pl-6 pt-2 md:pt-0 border-t md:border-t-0 mt-2 md:mt-0">
                    <p class="text-slate-600 break-words text-lg">${escapeHtml(card.definition)}</p>
                    ${exampleHtml}
                </div>
            </div>
        `;

        leftSideDiv.appendChild(starIcon);
        leftSideDiv.appendChild(contentDiv);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "flex items-center gap-2 flex-shrink-0";

        const editBtn = document.createElement("button");
        editBtn.className = "text-slate-300 hover:text-indigo-500 transition-colors p-2 rounded-full hover:bg-indigo-50";
        editBtn.innerHTML = `<span class="material-symbols-outlined">edit</span>`;
        editBtn.title = "Sửa từ này";
        editBtn.onclick = () => {
            if (typeof window.editSingleCard === "function") {
                const oldImg = card.imageUrl || card.ImageUrl || "";
               window.editSingleCard(card.id, card.term, card.definition, oldImg, card.example);
                
            }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "text-slate-300 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50";
        deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
        deleteBtn.title = "Xóa từ này";
        deleteBtn.onclick = () => {
            if (typeof window.deleteSingleCard === "function") {
                window.deleteSingleCard(card.id);
            } else {
                alert("Ông quên dán cái hàm deleteSingleCard vào app.js rồi kìa!");
            }
        };

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        termRow.appendChild(leftSideDiv);
        termRow.appendChild(actionsDiv); 
        
        container.appendChild(termRow);
    });
}