// editor.js
import { getState } from "./state.js";
import { hideModal } from "./navigation.js";
import { fetchStudySetsFromSQL } from "./api.js";

export function setupEditorListeners() {
    document.getElementById("createSetForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("createSetNameInput").value.trim();
        const userData = JSON.parse(localStorage.getItem("quizlet_user"));
        if (name) {
            try {
                const response = await fetch("https://localhost:7077/api/StudySets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: name, description: "", isPublic: true, userId: userData ? userData.id : 1 }),
                });
                if (!response.ok) return alert("Lỗi: Backend từ chối lưu!");
                const result = await response.json();
                const newSetId = result.data.id.toString();
                hideModal("createSetModal");
                if (window.logSystemActivity) window.logSystemActivity(`vừa tạo bộ từ vựng mới: "${name}".`, "library_add", "text-purple-500", "bg-purple-100");
                await fetchStudySetsFromSQL();
                if(window.navigateToSetView) window.navigateToSetView(newSetId);
            } catch (err) {
                alert("Lỗi kết nối Backend!");
            }
        }
    });

    document.getElementById("addCardForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const term = document.getElementById("addCardTermInput").value.trim();
        const def = document.getElementById("addCardDefInput").value.trim();
        const imageInputEl = document.getElementById("addCardImageInput");
        const imageUrl = imageInputEl ? imageInputEl.value.trim() : "";
        const exampleInputEl = document.getElementById("addCardExampleInput");
        const exampleText = exampleInputEl ? exampleInputEl.value.trim() : "";
        const activeSetId = getState().activeSetId;

        if (term && def) {
            try {
                const response = await fetch(`https://localhost:7077/api/Flashcards`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ term, definition: def, studySetId: parseInt(activeSetId), isStarred: false, imageUrl, example: exampleText }),
                });
                if (!response.ok) return alert("Lưu thẻ thất bại!");
                hideModal("addCardModal");
                if (window.logSystemActivity) window.logSystemActivity(`vừa thêm thẻ "${term}" vào bộ.`, "post_add", "text-blue-500", "bg-blue-100");
                document.getElementById("addCardTermInput").value = "";
                document.getElementById("addCardDefInput").value = "";
                if (imageInputEl) imageInputEl.value = "";
                if (exampleInputEl) exampleInputEl.value = "";
                await fetchStudySetsFromSQL();
                if(window.navigateToSetView) window.navigateToSetView(activeSetId);
            } catch (err) {
                alert("Lỗi kết nối Backend! Hãy chắc chắn C# đang chạy!");
            }
        }
    });

    document.getElementById("editCardForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const cardId = document.getElementById("editCardId").value;
        const newTerm = document.getElementById("editCardTermInput").value.trim();
        const newDef = document.getElementById("editCardDefInput").value.trim();
        const newImg = document.getElementById("editCardImageInput").value.trim();
        const exampleInputEl = document.getElementById("editCardExampleInput");
        const newExample = exampleInputEl ? exampleInputEl.value.trim() : "";
        const activeSetId = getState().activeSetId;

        try {
            const response = await fetch(`https://localhost:7077/api/Flashcards/${cardId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: parseInt(cardId), term: newTerm, definition: newDef, studySetId: parseInt(activeSetId), imageUrl: newImg, example: newExample })
            });
            if (response.ok) {
                document.getElementById("editCardModal").classList.add("hidden");
                if (window.logSystemActivity) window.logSystemActivity(`vừa cập nhật thẻ "${newTerm}".`, "edit_note", "text-amber-500", "bg-amber-100");
              await fetchStudySetsFromSQL();
                if(window.navigateToSetView) window.navigateToSetView(activeSetId);
            } else {
                alert("Lỗi: C# không chịu lưu cập nhật!");
            }
        } catch (err) {
            alert("Lỗi kết nối Backend C#!");
        }
    });

    document.getElementById("bulkImportCloseBtn")?.addEventListener("click", () => hideModal("bulkImportModal"));

    document.getElementById("importBtn")?.addEventListener("click", async () => {
        const rawText = document.getElementById("importText").value.trim();
        const delimiter = document.getElementById("importDelimiter").value;
        const activeSetId = getState().activeSetId;
        if (!rawText) return alert("Dữ liệu trống kìa ông ơi!");

        let cardsToImport = [];
        const lines = rawText.split("\n").filter((l) => l.trim() !== "");

        lines.forEach((line) => {
            let sep = delimiter;
            if (delimiter === "auto") {
                if (line.includes("\t")) sep = "\t";
                else if (line.includes(":")) sep = ":";
                else if (line.includes(";")) sep = ";";
                else if (line.includes(",")) sep = ",";
                else sep = "-";
            } else if (delimiter === "tab") sep = "\t";

            const parts = line.split(sep);
            if (parts.length >= 2) {
                cardsToImport.push({
                    term: parts[0].trim(), definition: parts[1].trim(),
                    imageUrl: parts.length >= 3 ? parts[2].trim() : "",
                    example: parts.length >= 4 ? parts.slice(3).join(sep).trim() : ""
                });
            }
        });

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
                    body: JSON.stringify({ term: card.term, definition: card.definition, studySetId: parseInt(activeSetId), isStarred: false, imageUrl: card.imageUrl, example: card.example }),
                });
                if (response.ok) successCount++;
            }
            alert(`Đã nạp thành công ${successCount}/${cardsToImport.length} thẻ vào SQL!`);
            document.getElementById("importText").value = "";
            hideModal("bulkImportModal");
            await fetchStudySetsFromSQL();
            if(window.navigateToSetView) window.navigateToSetView(activeSetId);
        } catch (err) {
            alert("Lỗi Backend!");
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<span class="material-symbols-outlined">upload</span> Import Cards`;
        }
    });
}