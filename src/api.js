import { getState, setState, addSet } from "./state.js";
import { saveState } from "./storage.js";

export const API_BASE_URL = "https://localhost:7077/api";
export const ELEVENLABS_API_BASE_URL = "https://api.elevenlabs.io/v1";

export async function apiRequest(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, options);
}

export async function apiJson(path, options = {}) {
  const response = await apiRequest(path, options);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export function loginUser(username, password) {
  return apiRequest("/Accounts/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function registerUser({ username, email, password }) {
  return apiRequest("/Accounts/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, passwordHash: password, role: "Learner" }),
  });
}

export function getUsers() {
  return apiJson("/Users");
}

export function deleteUserById(id) {
  return apiRequest(`/Users/${id}`, { method: "DELETE" });
}

export function getUserStats(userId) {
  return apiRequest(`/StudyProgresses/user/${userId}/stats`);
}

export function getAllStudySets() {
  return apiRequest("/StudySets");
}

export function getDashboardStudySets(userId) {
  return apiJson(`/StudySets/dashboard/${userId}`);
}

export function getDashboardStudySetsResponse(userId) {
  return apiRequest(`/StudySets/Dashboard/${userId}`);
}

export function createStudySet({ title, description = "", isPublic = true, userId }) {
  return apiRequest("/StudySets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, isPublic, userId }),
  });
}

export function deleteStudySet(setId) {
  return apiRequest(`/StudySets/${setId}`, { method: "DELETE" });
}

export function updateStudySet(setId, set) {
  return apiRequest(`/StudySets/${setId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(set),
  });
}

export function createFlashcard(card) {
  return apiRequest("/Flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

export function updateFlashcard(cardId, card) {
  return apiRequest(`/Flashcards/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

export function deleteFlashcard(cardId) {
  return apiRequest(`/Flashcards/${cardId}`, { method: "DELETE" });
}

export function toggleFlashcardStar(cardId, userId) {
  return apiRequest(`/Flashcards/toggle-star/${cardId}/${userId}`, { method: "POST" });
}

export function resetStudyProgress(setId, userId) {
  return apiRequest(`/StudyProgresses/reset/${setId}/${userId}`, { method: "DELETE" });
}

export function reviewFlashcard(payload) {
  return apiRequest("/StudyProgresses/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getActivityLogs(filterDate = "") {
  const query = filterDate ? `?date=${filterDate}` : "";
  return apiRequest(`/ActivityLogs${query}`);
}

export function logActivity(payload) {
  return apiRequest("/ActivityLogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getElevenLabsSpeechStream(voiceId, apiKey, text) {
  return fetch(`${ELEVENLABS_API_BASE_URL}/text-to-speech/${voiceId}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
}

export async function fetchStudySetsFromSQL() {
  try {
    const userData = JSON.parse(localStorage.getItem("quizlet_user"));
    const userId = userData ? userData.id : 0;

    console.log("Đang gọi API lấy dữ liệu từ SQL...");

    const response = await apiRequest(`/StudySets?userId=${userId}`, { cache: "no-store" });

    if (!response.ok) throw new Error("Không gọi được API!");
    const sqlData = await response.json();

    const currentState = getState();
    currentState.allSets = {};
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
