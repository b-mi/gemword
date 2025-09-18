import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';


@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  template: `
  <div class="app">
    <div class="toolbar">
      <button (click)="pasteFromClipboard()">Vložiť zo schránky</button>
      <button (click)="copyAsHtml()">Kopírovať ako HTML</button>
      <span style="margin-left:auto;opacity:.7">
        {{charCount()}} znakov • náhľad: Markdown→HTML
      </span>
    </div>

<textarea class="input"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
          placeholder="Sem píš Markdown alebo vlož text/HTML (Ctrl+V).">
</textarea>

    <div class="preview" [innerHTML]="previewHtml()"></div>
  </div>
  `,
})
export class AppComponent {
  text = signal('');
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  charCount = signal(0);

  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.text() ?? '', { async: false }) as string; // ← dôležité
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  constructor(private sanitizer: DomSanitizer) {
    effect(() => this.charCount.set((this.text ?? '').length));
  }

  async pasteFromClipboard() {
    try {
      // Preferuj HTML, fallback na text
      // @ts-ignore – typy Clipboard API sú neúplné
      const items: ClipboardItems = await navigator.clipboard.read?.();
      if (items && items.length) {
        const htmlItem = items.find(i => i.types?.includes('text/html'));
        if (htmlItem) {
          const blob = await htmlItem.getType('text/html');
          const html = await blob.text();
          this.text.set(this.td.turndown(html)); // HTML → Markdown
          return;
        }
      }
      const txt = await navigator.clipboard.readText();
      this.text.set(txt);
    } catch {
      // Fallback pre prostredia, kde je read() blokované – necháme userovi Ctrl+V
    }
  }

  async copyAsHtml() {
    const raw = marked.parse(this.text() ?? '', { async: false }) as string; // ← tu
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

    // Orez na „email-safe“ HTML (tu zatiaľ len sanitácia; profil zúžime neskôr)
    const html = `<!DOCTYPE html><html><body>${clean}</body></html>`;

    // Copy as text/html
    const blob = new Blob([html], { type: 'text/html' });
    // @ts-ignore
    await navigator.clipboard.write?.([new ClipboardItem({ 'text/html': blob })])
      .catch(async () => { await navigator.clipboard.writeText(html); });
  }

}
