// One modal dialog for Replace, Regenerate and Raw check (section 7.3).
// Focus starts on the safe button and returns to the opener on close.
// `onConfirm` runs inside the confirm click, for APIs that need user input.
import { h } from "./dom.js";

let pending = null;

export function confirmDialog({ title, message, items = [], confirmLabel, cancelLabel, opener, onConfirm }) {
  const dialog = document.getElementById("dialog");
  const confirm = document.getElementById("dialog-confirm");
  const cancel = document.getElementById("dialog-cancel");
  if (pending) pending(false);

  document.getElementById("dialog-title").textContent = title;
  const body = document.getElementById("dialog-body");
  body.replaceChildren(h("p", {}, message), items.length ? h("ul", {}, items.map((item) => h("li", {}, item))) : null);
  confirm.textContent = confirmLabel;
  cancel.textContent = cancelLabel;

  const returnFocus = opener ?? document.activeElement;
  return new Promise((resolve) => {
    const finish = (result) => {
      pending = null;
      confirm.onclick = null;
      cancel.onclick = null;
      dialog.oncancel = null;
      if (dialog.open) dialog.close();
      if (returnFocus && typeof returnFocus.focus === "function" && returnFocus.isConnected) returnFocus.focus();
      resolve(result);
    };
    pending = finish;
    confirm.onclick = () => {
      finish(true);
      onConfirm?.();
    };
    cancel.onclick = () => finish(false);
    dialog.oncancel = (event) => {
      event.preventDefault();
      finish(false);
    };
    dialog.showModal();
    cancel.focus();
  });
}
