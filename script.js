document.getElementById("eventLog").innerHTML = state.logs.length
        ? state.logs.map(l => `<div class="log-entry">${escapeHtml(l)}</div>`).join("")
        : `<div class="muted">Событий пока нет. Взаимодействуйте с товарами, чтобы увидеть пересчёт весов.</div>`;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function interact(productId, actionKey) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const user = getUser();
      applyDelta(user, product, actionKey);
      renderAll();
    }

    function addToCart(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const user = getUser();
      state.cart.push(product);
      applyDelta(user, product, "cart");
      renderAll();
    }

    function removeFromCart(index) {
      if (index < 0 || index >= state.cart.length) return;
      state.cart.splice(index, 1);
      renderAll();
    }

    function checkout() {
      if (!state.cart.length) {
        state.logs.unshift("Попытка оформить пустую корзину.");
        renderLogs();
        return;
      }
      const user = getUser();
      const items = state.cart.slice();
      const total = items.reduce((sum, item) => sum + item.price, 0);

      items.forEach(item => applyDelta(user, item, "buy"));
      state.orders.unshift({
        id: `ORD-${Date.now().toString().slice(-5)}`,
        userId: user.id,
        items,
        total
      });
      state.cart = [];
      state.logs.unshift(`${user.name}: оформлен заказ на ${total.toLocaleString("ru-RU")} ₸ (${items.map(i => i.id).join(", ")})`);
      renderAll();
    }

    function returnOrder(orderIndex) {
      const order = state.orders[orderIndex];
      if (!order) return;
      const user = getUser();

      order.items.forEach(item => applyDelta(user, item, "returnItem"));
      state.logs.unshift(`${user.name}: возврат по заказу #${orderIndex + 1} (${order.items.map(i => i.id).join(", ")})`);
      state.orders.splice(orderIndex, 1);
      renderAll();
    }

    function openExplain(productId) {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const user = getUser();
      const sc = scoreProduct(user, product);

      const topMatching = TRAITS
        .map(tr => ({
          trait: tr,
          uVal: user.traits[tr] ?? 0,
          pVal: product.traits[tr] ?? 0,
          contrib: Number(((user.traits[tr] ?? 0) * (product.traits[tr] ?? 0)).toFixed(3))
        }))
        .sort((a, b) => b.contrib - a.contrib)
        .slice(0, 4);

      document.getElementById("explainTitle").textContent = `Почему рекомендован: ${product.id} — ${product.name}`;
      document.getElementById("explainBody").innerHTML = `
        <p class="muted">Категория: <strong>${escapeHtml(product.category)}</strong> / ${escapeHtml(product.subcategory)} • Цена: <strong>${product.price.toLocaleString("ru-RU")} ₸</strong></p>
        <div class="rel-row">
          <div>
            <div><strong>Итоговый балл S_final: ${sc.final.toFixed(3)}</strong></div>
            <div class="muted">0.50·${sc.personal.toFixed(3)} (личный) + 0.20·${sc.group.toFixed(3)} (группа) + 0.20·${sc.related.toFixed(3)} (связь: ${escapeHtml(sc.relType)}) + 0.10·${sc.popular.toFixed(3)} (популярность)</div>
          </div>
        </div>
        <p><strong>Сегменты покупателя:</strong> ${sc.groups.map(g => `<span class="pill">${escapeHtml(g)}</span>`).join(" ")}</p>
        <p><strong>Ключевые совпадения по признакам (пользователь × товар):</strong></p>
        ${topMatching.map(m => `
          <div class="rel-row">
            <span><strong>${escapeHtml(m.trait)}</strong>: профиль ${m.uVal.toFixed(2)} × товар ${m.pVal.toFixed(2)}</span>
            <span class="score-tag">+${m.contrib.toFixed(3)}</span>
          </div>
        `).join("")}
      `;
      document.getElementById("explainModal").style.display = "flex";
    }

    function closeExplain() {
      document.getElementById("explainModal").style.display = "none";
    }

    function bindEvents() {
      document.getElementById("userSelect").addEventListener("change", (e) => {
        state.activeUserId = e.target.value;
        state.logs.unshift(`Выбран покупатель ${state.activeUserId} (${getUser().name}).`);
        renderAll();
      });

      document.getElementById("newVisitBtn").addEventListener("click", () => {
        const user = getUser();
        const topRec = products
          .map(p => ({ p, s: scoreProduct(user, p).final }))
          .sort((a, b) => b.s - a.s)[0]?.p;
        if (topRec) {
          applyDelta(user, topRec, "revisit");
        }
        state.logs.unshift(`${user.name}: начато новое посещение магазина.`);
        renderAll();
      });

      document.getElementById("resetDemoBtn").addEventListener("click", () => {
        state = {
          activeUserId: "U001",
          users: JSON.parse(JSON.stringify(INITIAL_USERS)),
          cart: [],
          orders: [],
          logs: ["Модель и состояние демо-стенда сброшены к исходным значениям."]
        };
        renderAll();
      });

      document.getElementById("catFilter").addEventListener("change", () => {
        document.getElementById("subcatFilter").value = "ALL";
        renderFilters();
        renderCatalogGrid();
      });

      document.getElementById("subcatFilter").addEventListener("change", renderCatalogGrid);
      document.getElementById("searchInput").addEventListener("input", renderCatalogGrid);

      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;
          document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
          document.getElementById("tabCatalog").style.display = tab === "catalog" ? "block" : "none";
          document.getElementById("tabTechmatch").style.display = tab === "techmatch" ? "block" : "none";
          if (tab === "techmatch") renderTechMatch(getUser());
        });
      });

      document.getElementById("baseProductSelect").addEventListener("change", () => {
        renderTechMatch(getUser());
      });

      document.getElementById("checkoutBtn").addEventListener("click", checkout);

      document.getElementById("closeModalBtn").addEventListener("click", closeExplain);
      document.getElementById("explainModal").addEventListener("click", (e) => {
        if (e.target.id === "explainModal") closeExplain();
      });
    }

    bindEvents();
    renderAll();
  </script>
</body>
</html>