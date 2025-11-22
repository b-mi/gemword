import { Component, signal, computed, inject, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
// Uisti sa, že cesta k servicu je správna
import { AppService } from '../app.service'; 

interface SwitchOption {
  label: string;
  value: string;
  description: string;
  checked: boolean;
}

@Component({
  selector: 'app-form4',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form4.component.html',
  styleUrl: './form4.component.scss'
})
export class Form4Component {

  private service = inject(AppService);
  private sanitizer = inject(DomSanitizer);
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  switches: SwitchOption[] = [
    { label: 'Oprava preklepov', value: 'fix', description: 'Oprav preklepy a diakritiku. Odpoveď len opravený text bez akýchkoľvek ďalších textov.', checked: true },
    { label: 'Profesionálny', value: 'professional', description: 'Použi neutrálny, formálny a profesionálny štýl.', checked: false },
    { label: 'Priateľský', value: 'friendly', description: 'Použi priateľský, hovorový tón.', checked: true },
    { label: 'Prelož do angličtiny', value: 'toen', description: 'Prelož do angličtiny.', checked: false },
    { label: 'Prelož do slovenčiny', value: 'tosk', description: 'Prelož do slovenčiny.', checked: false },
  ];

  inputText = signal<string>('');
  rawOutput = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Preview HTML (ak by si ho chcel v budúcnosti zobraziť)
  previewHtml = computed<SafeHtml>(() => {
    const raw = this.rawOutput();
    if (!raw) return '';
    const parsed = marked.parse(raw, { async: false }) as string;
    const clean = DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  constructor() {
    this.loadState();
  }

  toggleSwitch(item: SwitchOption) {
    item.checked = !item.checked;
    this.storeState();
  }

  async handleGenerate() {
    const input = this.inputText()?.trim();
    if (!input || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const instructionsArr: string[] = this.switches
      .filter(s => s.checked)
      .map(s => s.description);

    try {
      const apiBaseUrl = isDevMode() ? '' : this.service.url;
      const apiUrl = `${apiBaseUrl}/api/correct`;
      
      const body = JSON.stringify({ 
        text: input, 
        instruction: instructionsArr.join('\n'), 
        temperature: 0.3 
      });

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (resp.ok) {
        const { corrected } = await resp.json();
        if (typeof corrected === 'string') {
          this.rawOutput.set(corrected);
        }
        this.storeState();
      } else {
        throw new Error(`API Error: ${resp.status}`);
      }
    } catch (e: any) {
      console.error(e);
      this.error.set(e.message || 'Chyba komunikácie.');
    } finally {
      this.isLoading.set(false);
    }
  }

  handleClear() {
    this.inputText.set('');
    this.rawOutput.set('');
    this.storeState();
  }

  async handlePaste() {
    try {
      // @ts-ignore
      const items = await navigator.clipboard.read?.();
      if (items?.length) {
        const htmlItem = items.find((i: any) => i.types?.includes('text/html'));
        if (htmlItem) {
          const blob = await htmlItem.getType('text/html');
          const html = await blob.text();
          this.inputText.set(this.td.turndown(html));
          return;
        }
      }
      const txt = await navigator.clipboard.readText();
      this.inputText.set(txt);
    } catch { }
  }

  async copyAsRawText() {
    await navigator.clipboard.writeText(this.rawOutput() || '');
  }
  
  // Túto metódu môžeš použiť pre tlačidlo Copy HTML
  async copyPreviewHtml() {
     // Získame HTML string z preview (treba obísť SafeHtml wrapper pre copy)
     const raw = this.rawOutput();
     if(!raw) return;
     const parsed = marked.parse(raw, { async: false }) as string;
     const type = 'text/html';
     const blob = new Blob([parsed], { type });
     const data = [new ClipboardItem({ [type]: blob })];
     await navigator.clipboard.write(data);
  }

  private storeState() {
    const state = {
      text: this.inputText(),
      switches: this.switches.map(s => ({ value: s.value, checked: s.checked }))
    };
    localStorage.setItem('data_v4', JSON.stringify(state));
  }

  private loadState() {
    const str = localStorage.getItem('data_v4');
    if (str) {
      try {
        const data = JSON.parse(str);
        if (data.text) this.inputText.set(data.text);
        if (Array.isArray(data.switches)) {
          data.switches.forEach((saved: any) => {
            const existing = this.switches.find(s => s.value === saved.value);
            if (existing) existing.checked = saved.checked;
          });
        }
      } catch (e) { console.error(e); }
    }
  }
}