// renderLearn.js
import { escapeHtml, shuffleArray } from "./renderUtils.js";

// Biến toàn cục để lưu trạng thái, phục vụ cho việc đổi game tại chỗ bằng Combobox (Khai báo 1 lần duy nhất)
let currentLearnSession = null;
let currentLearnSet = null;
let currentLearnHandlers = null;

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
  currentLearnSession = session;
  currentLearnSet = set;
  currentLearnHandlers = handlers;

  const questionText = document.getElementById("questionText");
  const gradeButtons = document.getElementById("gradeButtons");
  const answerOptions = document.getElementById("answerOptions");
  const textInputArea = document.getElementById("textInputArea");
  const arrangeArea = document.getElementById("arrangeArea");
  const modeSelect = document.getElementById("gameModeSelect");

  if (!session.currentQuestionId) return;

  const card = set.cards.find((c) => c.uuid === session.currentQuestionId);
  if (!card) return;

  if (modeSelect && !modeSelect.dataset.listener) {
      modeSelect.addEventListener("change", () => {
          renderLearnQuestion(currentLearnSession, currentLearnSet, currentLearnHandlers);
      });
      modeSelect.dataset.listener = "true";
  }

  // 1. Ẩn sạch sẽ mọi bàn chơi
  if (gradeButtons) gradeButtons.classList.add("hidden");
  if (answerOptions) answerOptions.classList.add("hidden");
  if (textInputArea) textInputArea.classList.add("hidden");
  if (arrangeArea) arrangeArea.classList.add("hidden");

  // 2. Xác định các game có thể chơi
  const exampleText = card.example || card.Example || "";
  let availableModes = ["MULTIPLE_CHOICE", "DICTATION"];
  
  if (exampleText && exampleText.trim().length > 5) {
      availableModes.push("FILL_BLANK");
      availableModes.push("ARRANGE");
  }

  // 3. Đọc yêu cầu từ Combobox
  let selectedMode = modeSelect ? modeSelect.value : "AUTO";
  let modeToPlay = "MULTIPLE_CHOICE";

  if (selectedMode === "AUTO") {
      modeToPlay = availableModes[Math.floor(Math.random() * availableModes.length)];
  } else {
      modeToPlay = availableModes.includes(selectedMode) ? selectedMode : "MULTIPLE_CHOICE";
  }

  // 🔥 ĐÚC LẠI NÚT LOA MỚI 🔥
  const qTextDiv = document.getElementById("questionText").parentNode;
  const qContainer = qTextDiv.parentNode;
  
  const oldButtons = qContainer.querySelectorAll("button");
  oldButtons.forEach(btn => btn.remove());

  const newSpeakBtn = document.createElement("button");
  newSpeakBtn.className = "mr-6 text-indigo-500 hover:text-indigo-700 flex-shrink-0 transition-all p-3 rounded-full hover:bg-indigo-100 shadow-md cursor-pointer transform hover:scale-110 active:scale-95";
  newSpeakBtn.innerHTML = `<span class="material-symbols-outlined text-4xl pointer-events-none">volume_up</span>`;
  
  qContainer.insertBefore(newSpeakBtn, qTextDiv);

  // 🔥 FIX Ở ĐÂY: ÉP CỨNG 100% ĐỌC TIẾNG ANH BẤT CHẤP MỌI THỂ LOẠI GAME 🔥
  let textToRead = card.term; // Mặc định luôn là Từ Tiếng Anh
  let lang = 'en-US'; 
  let rate = 0.85; // Đọc chậm cho dễ chép
  
  if (modeToPlay === "ARRANGE") {
      textToRead = card.example || card.term; // Trò xếp câu thì đọc ví dụ Tiếng Anh
      rate = 0.9;
  }

  const playAudio = () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel(); 
      const msg = new SpeechSynthesisUtterance(textToRead);
      msg.lang = lang; 
      msg.rate = rate;
      window.speechSynthesis.speak(msg);
  };

  newSpeakBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation(); 
      playAudio();
      document.getElementById("learnTextInput")?.focus(); 
  });

  if (modeToPlay === "DICTATION") {
      setTimeout(playAudio, 300); 
  }

  // 4. Bật đúng Game lên
  if (modeToPlay === "MULTIPLE_CHOICE") {
      questionText.innerHTML = escapeHtml(card.definition);
      answerOptions.classList.remove("hidden");
      renderMultipleChoice(session, set, handlers);
  } 
  else if (modeToPlay === "DICTATION") {
      questionText.innerHTML = `<span class="material-symbols-outlined text-5xl text-indigo-500 mb-2 drop-shadow-md">headphones</span><br><span class="text-slate-600 font-bold text-lg uppercase tracking-wider">Nghe và gõ lại từ</span><br><span class="text-sm text-slate-400 mt-2 block">Gợi ý: ${escapeHtml(card.definition)}</span>`;
      textInputArea.classList.remove("hidden");
      setupTextInput(card, handlers);
  } 
  else if (modeToPlay === "FILL_BLANK") {
      const regex = new RegExp(card.term, "gi"); 
      const blankedExample = exampleText.replace(regex, "________");
      questionText.innerHTML = `<span class="text-slate-500 text-sm font-bold block mb-3 uppercase tracking-wider">Điền từ còn thiếu</span><span class="text-xl font-medium text-slate-800 leading-relaxed">" ${escapeHtml(blankedExample)} "</span><br><span class="text-sm text-indigo-400 mt-3 block">( Gợi ý: ${escapeHtml(card.definition)} )</span>`;
      textInputArea.classList.remove("hidden");
      setupTextInput(card, handlers);
  } 
  else if (modeToPlay === "ARRANGE") {
      questionText.innerHTML = `<span class="text-slate-500 text-sm font-bold block mb-3 uppercase tracking-wider">Sắp xếp câu ví dụ</span><span class="text-lg font-medium text-indigo-600">Dịch nghĩa của từ: ${escapeHtml(card.definition)}</span>`;
      arrangeArea.classList.remove("hidden");
      setupArrange(card, handlers);
  }
}
// ==========================================
// HỆ THỐNG MINI GAMES MỚI (Gõ chữ & Xếp câu)
// ==========================================
function setupTextInput(card, handlers) {
    const input = document.getElementById("learnTextInput");
    const oldBtn = document.getElementById("submitTextBtn");
    
    if (!input || !oldBtn) return;

    input.value = "";
    input.disabled = false;
    input.className = "w-full max-w-md px-4 py-3 text-lg border-2 border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-center font-semibold text-slate-700 shadow-inner transition-colors";
    
    // Đảm bảo mỗi lần qua câu mới là ô input sạch sẽ và sẵn sàng
    setTimeout(() => input.focus(), 50);

    // Dọn dẹp sự kiện cũ chống click đúp
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    
    const checkAnswer = () => {
        // 🔥 MẸO CHÍ MẠNG: Lấy lại element ngay tại giây phút bấm để đảm bảo giá trị mới nhất
        const currentInput = document.getElementById("learnTextInput");
        if (currentInput.disabled) return; // Chống bấm nhiều lần khi đã có kết quả

        const rawValue = currentInput.value || "";
        const userAnswer = rawValue.trim().toLowerCase();
        const correctAnswer = card.term.trim().toLowerCase();

        if (!userAnswer) {
            currentInput.focus();
            return; 
        }

        const isCorrect = userAnswer === correctAnswer;
        
        currentInput.disabled = true;
        
        if (isCorrect) {
            currentInput.classList.remove("border-slate-300");
            currentInput.classList.add("border-green-500", "bg-green-50", "text-green-700");
        } else {
            currentInput.classList.remove("border-slate-300");
            currentInput.classList.add("border-red-500", "bg-red-50", "text-red-700");
        }

        // Gọi hàm xử lý kết quả (cộng điểm, qua câu tiếp...)
        if (handlers && typeof handlers.onAnswer === "function") {
            handlers.onAnswer(isCorrect, currentInput, card.uuid);
        }
    };

    // Bắt sự kiện Click nút
    btn.onclick = (e) => {
        e.preventDefault();
        checkAnswer();
    };

    // Bắt sự kiện Enter (Dùng keydown cho nhạy hơn keypress)
    input.onkeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            checkAnswer();
        }
    };
}

function setupArrange(card, handlers) {
    const source = document.getElementById("arrangeSource");
    const target = document.getElementById("arrangeTarget");
    const oldBtn = document.getElementById("submitArrangeBtn");
    
    // 1. TẠO NÚT MỚI VÀ THAY THẾ NÚT CŨ TRƯỚC TIÊN
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);

    // 2. DỌN DẸP KHUNG CHƠI
    source.innerHTML = "";
    target.innerHTML = "";
    
    // 🔥 3. FIX CỨNG: LỘT BỎ TÀNG HÌNH, HIỆN NÚT KIỂM TRA NGAY LẬP TỨC!
    btn.classList.remove("hidden");
    btn.disabled = false;

    const exampleText = card.example || card.Example || "";
    let words = exampleText.split(/\s+/).filter(w => w.trim() !== "");
    const originalWords = [...words]; 
    words = shuffleArray(words); 

    words.forEach((word) => {
        const pill = document.createElement("button");
        pill.className = "px-4 py-2 bg-white border-2 border-slate-200 rounded-xl shadow-sm text-slate-700 font-bold hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all cursor-pointer transform hover:-translate-y-1 active:scale-95";
        pill.textContent = word;
        pill.dataset.word = word;

        // Logic Click bay qua bay lại
        pill.addEventListener("click", function() {
            if (this.parentNode === source) target.appendChild(this);
            else source.appendChild(this);
        });
        source.appendChild(pill);
    });

    // 4. BẮT SỰ KIỆN CHO NÚT KIỂM TRA MỚI
    btn.addEventListener("click", () => {
        if (target.children.length === 0) {
            alert("Ê ní ơi, chưa xếp chữ nào mà đã bấm kiểm tra rồi kìa!");
            return;
        }

        const userSentence = Array.from(target.children).map(p => p.dataset.word).join(" ");
        const correctSentence = originalWords.join(" ");
        const isCorrect = userSentence === correctSentence;

        // Bấm xong thì khóa nút lại chống click đúp
        btn.disabled = true; 

        Array.from(target.children).forEach(p => {
            p.disabled = true;
            if (isCorrect) p.classList.add("bg-green-100", "border-green-500", "text-green-700");
            else p.classList.add("bg-red-100", "border-red-500", "text-red-700");
        });

        Array.from(source.children).forEach(p => {
            p.disabled = true;
            p.classList.add("opacity-50");
        });

        handlers.onAnswer?.(isCorrect, target, card.uuid);
    });
}

// ==========================================
// CÁC HÀM CŨ CỦA ÔNG (Trắc nghiệm & Giao diện)
// ==========================================

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
    feedbackText.innerHTML = `The correct answer was <span class="font-bold text-indigo-600 text-lg px-2 bg-indigo-50 rounded">${escapeHtml(correctAnswer)}</span>. We'll ask this again later.`;
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