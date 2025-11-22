import { Component, signal, computed, inject, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { AppService } from '../app.service'; 

interface SwitchOption {
  label: string;
  value: string;
  description: string;
  checked: boolean;
}

@Component({
  selector: 'app-form3',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form3.component.html',
  styleUrl: './form3.component.scss'
})
export class Form3Component {

  private service = inject(AppService);
  private sanitizer = inject(DomSanitizer);
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  // 1. Tvoje zjednodušené možnosti (odstránil som readonly, aby sa dali meniť)
  switches: SwitchOption[] = [
    { label: 'Oprava preklepov', value: 'fix', description: 'Oprav preklepy a diakritiku.', checked: true },
    { label: 'Profesionálny', value: 'professional', description: 'Použi neutrálny, formálny a profesionálny štýl.', checked: false },
    { label: 'Priateľský', value: 'friendly', description: 'Použi priateľský, hovorový tón.', checked: true },
    { label: 'Prelož do angličtiny', value: 'toen', description: 'Prelož do angličtiny.', checked: false },
    { label: 'Prelož do slovenčiny', value: 'tosk', description: 'Prelož do slovenčiny.', checked: false },
  ];

  // 2. Ostatné signály
  inputText = signal<string>('');
  rawOutput = signal<string>('');
  customInstruction = signal<string>('');
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.rawOutput() ?? '', { async: false }) as string;
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  constructor() {
    this.loadState();
  }

  // --- Logika ---

  toggleSwitch(item: SwitchOption) {
    item.checked = !item.checked;
    this.storeState(); // Uložíme zmenu hneď
  }

  async handleGenerate() {
    const input = this.inputText()?.trim();
    if (!input || this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    // Zbieranie inštrukcií len z tých, čo sú CHECKED
    const instructionsArr: string[] = this.switches
      .filter(s => s.checked)
      .map(s => s.description);

    const custom = this.customInstruction();
    if (custom) instructionsArr.push(`Dodatočné inštrukcie: ${custom}`);

    const all_instructions = instructionsArr.join('\n');
    
    try {
      const apiBaseUrl = isDevMode() ? '' : this.service.url;
      const apiUrl = `${apiBaseUrl}/api/correct`;
      
      const body = JSON.stringify({ 
        text: input, 
        instruction: all_instructions, 
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
        // Uložíme text (switche sa ukladajú pri prepnutí)
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

  // --- Pomocné metódy (Copy/Paste) ostávajú rovnaké ---
  handleClear() {
    this.inputText.set('');
    this.rawOutput.set('');
    this.customInstruction.set('');
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
  
  async copyAsHtml(html: string) {
    const type = 'text/html';
    const blob = new Blob([html], { type });
    const data = [new ClipboardItem({ [type]: blob })];
    await navigator.clipboard.write(data);
  }

  // --- Storage ---
  private storeState() {
    const state = {
      text: this.inputText(),
      custom: this.customInstruction(),
      // Uložíme len stavy switchov (value -> checked)
      switches: this.switches.map(s => ({ value: s.value, checked: s.checked }))
    };
    localStorage.setItem('data_v3_simple', JSON.stringify(state));
  }

  private loadState() {
    const str = localStorage.getItem('data_v3_simple');
    if (str) {
      try {
        const data = JSON.parse(str);
        if (data.text) this.inputText.set(data.text);
        if (data.custom) this.customInstruction.set(data.custom);
        
        // Obnovíme stav switchov
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