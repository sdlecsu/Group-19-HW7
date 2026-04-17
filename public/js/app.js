(function () {
  "use strict";

  const listTitlesEl = document.getElementById("list-titles");
  const newListForm = document.getElementById("new-list-form");
  const newListTitle = document.getElementById("new-list-title");
  const detailEmpty = document.getElementById("detail-empty");
  const detailContent = document.getElementById("detail-content");
  const detailHeading = document.getElementById("detail-heading");
  const deleteListBtn = document.getElementById("delete-list-btn");
  const newEntryForm = document.getElementById("new-entry-form");
  const newEntryText = document.getElementById("new-entry-text");
  const entriesList = document.getElementById("entries-list");

  /** @type {string | null} */
  let selectedListId = null;

  function showError(container, message) {
    let el = container.querySelector(".msg-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "msg-error";
      container.insertBefore(el, container.firstChild);
    }
    el.textContent = message;
    el.hidden = false;
  }

  function clearError(container) {
    const el = container.querySelector(".msg-error");
    if (el) el.remove();
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options && options.headers),
      },
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || res.statusText || "Request failed");
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  async function loadListSummaries() {
    const lists = await fetchJson("/api/lists");
    listTitlesEl.innerHTML = "";
    lists.forEach((list) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = list.title;
      btn.dataset.listId = list.id;
      if (list.id === selectedListId) btn.classList.add("selected");
      btn.addEventListener("click", () => selectList(list.id));
      li.appendChild(btn);
      listTitlesEl.appendChild(li);
    });
  }

  function listsPanel() {
    return document.querySelector(".lists-panel");
  }

  function setDetailVisible(hasSelection) {
    detailEmpty.classList.toggle("hidden", hasSelection);
    detailContent.classList.toggle("hidden", !hasSelection);
  }

  async function selectList(id) {
    selectedListId = id;
    clearError(detailContent);
    Array.from(listTitlesEl.querySelectorAll("button")).forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.listId === id);
    });
    if (!id) {
      setDetailVisible(false);
      return;
    }
    setDetailVisible(true);
    const list = await fetchJson("/api/lists/" + encodeURIComponent(id));
    detailHeading.textContent = list.title;
    renderEntries(list.entries || []);
  }

  function renderEntries(entries) {
    entriesList.innerHTML = "";
    entries.forEach((entry) => {
      const li = document.createElement("li");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "entry-check";
      cb.checked = entry.status === true;
      cb.setAttribute("aria-label", "Mark complete: " + entry.text);
      cb.addEventListener("change", async () => {
        try {
          await fetchJson(
            "/api/lists/" + encodeURIComponent(selectedListId) + "/entries/" + encodeURIComponent(entry.id),
            {
              method: "PATCH",
              body: JSON.stringify({ status: cb.checked }),
            }
          );
          const label = li.querySelector(".entry-text");
          if (label) label.classList.toggle("done", cb.checked);
        } catch (e) {
          cb.checked = !cb.checked;
          showError(detailContent, e.message || "Could not update task");
        }
      });

      const span = document.createElement("span");
      span.className = "entry-text" + (entry.status ? " done" : "");
      span.textContent = entry.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "entry-delete btn-danger";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (!selectedListId) return;
        try {
          await fetch("/api/lists/" + encodeURIComponent(selectedListId) + "/entries/" + encodeURIComponent(entry.id), {
            method: "DELETE",
          }).then(async (res) => {
            if (!res.ok) {
              const t = await res.json().catch(() => ({}));
              throw new Error(t.error || res.statusText);
            }
          });
          await selectList(selectedListId);
        } catch (e) {
          showError(detailContent, e.message || "Could not delete task");
        }
      });

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      entriesList.appendChild(li);
    });
  }

  newListForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(listsPanel());
    const title = newListTitle.value.trim();
    if (!title) return;
    try {
      const created = await fetchJson("/api/lists", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      newListTitle.value = "";
      await loadListSummaries();
      await selectList(created.id);
    } catch (err) {
      showError(listsPanel(), err.message || "Could not create list");
    }
  });

  newEntryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedListId) return;
    clearError(detailContent);
    const text = newEntryText.value.trim();
    if (!text) return;
    try {
      await fetchJson("/api/lists/" + encodeURIComponent(selectedListId) + "/entries", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      newEntryText.value = "";
      await selectList(selectedListId);
    } catch (err) {
      showError(detailContent, err.message || "Could not add task");
    }
  });

  deleteListBtn.addEventListener("click", async () => {
    if (!selectedListId) return;
    clearError(detailContent);
    if (!window.confirm("Delete this list and all its tasks?")) return;
    try {
      await fetch("/api/lists/" + encodeURIComponent(selectedListId), { method: "DELETE" }).then(async (res) => {
        if (!res.ok) {
          const t = await res.json().catch(() => ({}));
          throw new Error(t.error || res.statusText);
        }
      });
      selectedListId = null;
      setDetailVisible(false);
      await loadListSummaries();
    } catch (err) {
      showError(detailContent, err.message || "Could not delete list");
    }
  });

  loadListSummaries().catch((err) => {
    showError(listsPanel(), err.message || "Could not load lists. Is the server running?");
  });
})();
