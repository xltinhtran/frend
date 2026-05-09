import { getState, setState, addSet } from "./state.js";
import { saveState } from "./storage.js";

export async function fetchStudySetsFromSQL() {
  try {
    const userData = JSON.parse(localStorage.getItem("quizlet_user"));
    const userId = userData ? userData.id : 0;

    console.log("Đang gọi API lấy dữ liệu từ SQL...");

    const response = await fetch(
      `https://localhost:7077/api/StudySets?userId=${userId}`,
      { cache: "no-store" }
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
            imageUrl: sqlCard.imageUrl || sqlCard.ImageUrl || "",
            example: sqlCard.example || sqlCard.Example || "", 
            stats: {
              repetitions: sqlCard.repetitions,
              interval: sqlCard.interval,
              easeFactor: sqlCard.easeFactor,
              dueAt: sqlCard.nextReviewDate ? new Date(sqlCard.nextReviewDate).getTime() : null,
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