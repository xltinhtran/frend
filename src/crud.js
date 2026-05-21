import { getState, setState, getAllSets, getDueCards } from "./state.js";
import { saveState } from "./storage.js";
import { fetchStudySetsFromSQL } from "./api.js";
import { navigateToLearnMode } from "./learn.js";


export async function handleResetProgress(setId) {
  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  if (!userData) return alert("Phải đăng nhập mới reset được ông ơi!");

  if (!confirm("Ông có chắc muốn xóa sạch tiến độ bộ này để học lại từ đầu không?")) return;

  try {
    const response = await fetch(
      `https://localhost:7077/api/StudyProgresses/reset/${setId}/${userData.id}`,
      { method: "DELETE" },
    );

    if (response.ok) {
      // 🔥 BOM NGUYÊN TỬ: XÓA SẠCH 100% BỘ NHỚ TRÌNH DUYỆT 🔥
      const savedUser = localStorage.getItem("quizlet_user"); // Cất tài khoản
      
      localStorage.clear(); // Nổ tung mọi file save kẹt lại
      sessionStorage.clear();
      
      if (savedUser) localStorage.setItem("quizlet_user", savedUser); // Trả tài khoản về

      alert("Đã xóa sạch bộ nhớ, tiến độ về 0%!");
      window.location.reload(); 
    }
  } catch (err) {
    console.error("Lỗi reset:", err);
  }
}

export async function handleToggleStar(cardId) {
  const currentState = getState();
  const setId = currentState.activeSetId;
  const set = currentState.sets[setId];
  if (!set) return;

  saveState();

  const userData = JSON.parse(localStorage.getItem("quizlet_user"));
  const userId = userData ? userData.id : 1;

  try {
    fetch(
      `https://localhost:7077/api/Flashcards/toggle-star/${cardId}/${userId}`,
      { method: "POST" },
    );
  } catch (err) {
    console.error("Lỗi đồng bộ sao", err);
  }
}

export async function handleDeleteCurrentSet() {
  const activeSetId = getState().activeSetId;
  if (!activeSetId) return;

  if (!confirm("CẢNH BÁO: Ông sắp xóa TOÀN BỘ bộ thẻ này. Chắc chắn chưa?")) return;

  try {
    const response = await fetch(
      `https://localhost:7077/api/StudySets/${activeSetId}`,
      { method: "DELETE" },
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
    if (window.logSystemActivity) window.logSystemActivity("vừa xóa hẳn một bộ từ vựng.", "delete_forever", "text-red-600", "bg-red-200");
  window.location.hash = "#home";
    window.dispatchEvent(new Event("hashchange"));
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối Backend!");
  }
}

export function handleStudy5Min() {
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

export function handleReviewAllDue() {
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

export function setupLevelFilter() {
  const studySelect = document.getElementById("quickActionStudy");
  if (!studySelect) return;

  studySelect.addEventListener("change", (e) => {
    const level = e.target.value;
    const allCards = document.querySelectorAll(".set-card");

    allCards.forEach((card) => {
      const title = card.querySelector("h3").innerText.toUpperCase();
      let shouldShow = false;

      if (level === "all") shouldShow = true;
      else if (level === "easy" && (title.includes("A1") || title.includes("A2"))) shouldShow = true;
      else if (level === "medium" && (title.includes("B1") || title.includes("B2"))) shouldShow = true;
      else if (level === "hard" && (title.includes("C1") || title.includes("C2"))) shouldShow = true;

      card.style.display = shouldShow ? "" : "none";
    });
  });
}

export function handleRandomSet() {
  const allSets = getAllSets();
  const setIds = Object.keys(allSets).filter(
    (id) => allSets[id].cards.length >= 2,
  );

  if (setIds.length === 0)
    return alert("Kiếm bộ nào có từ 2 thẻ trở lên mới chơi random được!");

  const randomId = setIds[Math.floor(Math.random() * setIds.length)];
  navigateToLearnMode(randomId, { mode: "all" });
}

window.deleteSingleCard = async function(cardId) {
    if (!confirm("Ê ní, có chắc là muốn xóa từ này khỏi bộ không?")) return;
    try {
        const response = await fetch(`https://localhost:7077/api/Flashcards/${cardId}`, {
            method: "DELETE"
        });
        if (response.ok) {
            await fetchStudySetsFromSQL(); 
            if (window.logSystemActivity) window.logSystemActivity("vừa xóa một thẻ từ vựng.", "delete", "text-red-500", "bg-red-100");
            const activeSetId = getState().activeSetId;
            
            if (window.navigateToSetView) window.navigateToSetView(activeSetId); 
        } else {
            alert("Lỗi: Backend C# từ chối xóa!");
        }
    } catch (err) {
        alert("Lỗi kết nối Backend! C# tắt rồi hả?");
    }
};

window.editSingleCard = function(cardId, oldTerm, oldDef, oldImg, oldExample = "") {
    document.getElementById("editCardId").value = cardId;
    document.getElementById("editCardTermInput").value = oldTerm;
    document.getElementById("editCardDefInput").value = oldDef;
    document.getElementById("editCardImageInput").value = oldImg;
    
    const exampleInputEl = document.getElementById("editCardExampleInput");
    if (exampleInputEl) {
        exampleInputEl.value = oldExample || "";
    }

    const editModal = document.getElementById("editCardModal");
    if (editModal) {
        editModal.classList.remove("hidden");
    } else {
        alert("Chưa copy đoạn HTML Modal Sửa Thẻ vào file index.html kìa ông ơi!");
    }
};