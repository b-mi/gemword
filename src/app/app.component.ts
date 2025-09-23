import { Component, signal, computed, effect, OnInit, inject, isDevMode, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { AppService } from './app.service';

// --- Typy pre UI stavy (použité v logike nižšie) ---
type OperationType = 'korektura' | 'stylizacia' | 'formatovanie' | 'zhrnutie';
type TabType = 'korektura' | 'stylizacia' | 'formatovanie' | 'sumarizacia';


@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  
  // ====================================================================
  // --- CORE LOGIKA A STAV (spoločná pre všetky varianty A, B, C) ---
  // ====================================================================
  
  service: AppService = inject(AppService);
  text = signal('');
  raw_text = signal('');
  instructions = signal('');
  moods_text = signal('');
  busy = signal(false);

  moods = [
    { name: 'Profesionálny', checked: true, prompt: 'Použi neutrálny, formálny a profesionálny štýl.', col: 1, keywords: ['profesionalny', 'formalny', 'oficialny'] },
    { name: 'Priateľský', checked: false, prompt: 'Použi priateľský, hovorový tón.', col: 1, keywords: ['priatelsky', 'hovorovy', 'neformalny'] },
    { name: 'Veselý', checked: false, prompt: 'Použi veselý a pozitívny tón, pridaj ľahkosť do textu.', col: 1, keywords: ['vesely', 'pozitivny', 'hravy'] },
    { name: 'Odmeraný', checked: false, prompt: 'Použi strohý, faktický tón bez emócií.', col: 1, keywords: ['odmerany', 'strohy', 'fakticky'] },

    { name: 'Stručný', checked: false, prompt: 'Zjednoduš a skráť vety, vyjadruj sa čo najstručnejšie.', col: 2, keywords: ['strucny', 'skrateny', 'kratky'] },
    { name: 'Detailný', checked: false, prompt: 'Rozviň text, doplň detaily a vysvetlenia.', col: 2, keywords: ['detailny', 'rozvinuty', 'podrobny'] },
    { name: 'Zhrnutie', checked: false, prompt: 'Zhrň text do maximálne 3 viet.', col: 2, keywords: ['zhrnutie', 'summary', 'vycuc'] },
    { name: 'Bullet list', checked: false, prompt: 'Rozdeľ obsah do odrážok pre lepšiu čitateľnosť.', col: 2, keywords: ['bulletlist', 'bullety', 'odrazky-zoznam'] },
    { name: 'Odseky', checked: false, prompt: 'Rozdeľ text do prehľadných odsekov.', col: 2, keywords: ['odseky', 'paragrafy'] },

    { name: 'Email', checked: false, prompt: 'Premeň text na formálny e-mail vhodný na odoslanie.', col: 3, keywords: ['email', 'mail'] },
    { name: 'SMS', checked: false, prompt: 'Premeň text na krátku SMS správu, údernú a bez omáčok.', col: 3, keywords: ['sms', 'sprava'] },
    { name: 'Kreatívny', checked: false, prompt: 'Preformuluj text do tvorivého štýlu: používaj expresívne a obrazné vyjadrenia, pridaj hravosť a originalitu.', col: 3, keywords: ['kreativny', 'tvorivy', 'obrazny'] },

    { name: 'Md - zachovať', checked: false, prompt: 'Zachovaj pôvodné Markdown formátovanie textu bez zmien.', col: 4, keywords: ['md-zachovat', 'md-ponechat'] },
    { name: 'Md - preformátovať', checked: false, prompt: 'Naformátuj text do čitateľného Markdownu (nadpisy, odseky, odrážky).', col: 4, keywords: ['md-preformatovat', 'md-format'] },
    { name: 'Md - odrážky', checked: false, prompt: 'Preveď dlhšie zoznamy alebo vety na Markdown bullet list.', col: 4, keywords: ['md-odrazky', 'md-bullet'] },
    { name: 'Md - číslovaný zoznam', checked: false, prompt: 'Premeň kroky alebo postup na očíslovaný Markdown zoznam.', col: 4, keywords: ['md-cislovany', 'md-numbered'] },
    { name: 'Md - tabuľka', checked: false, prompt: 'Preveď štruktúrované údaje do Markdown tabuľky.', col: 4, keywords: ['md-tabulka', 'md-table'] }
  ];
  
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.raw_text() ?? '', { async: false }) as string;
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });
  
  cols: any[][];

  constructor(private sanitizer: DomSanitizer) {
    this.cols = this.moods.reduce(
      (a, m) => (a[m.col - 1].push(m), a),
      [[], [], [], []] as any[][]
    );
    const str = localStorage.getItem('data');
    if (str) {
      const data = JSON.parse(str);
      this.text.set(data.text);
      this.instructions.set(data.instructions);
      const smoods = data.moods as any[];
      const dct = new Map(smoods.map(s => [s.name, s.checked] as const));
      this.moods.forEach(m => { if (dct.has(m.name)) m.checked = dct.get(m.name)!; });
    }
  }

  ngOnInit(): void {
    this.onMoodChange();
  }

  // ====================================================================
  // --- UI LOGIKA (obsahuje stavy a metódy pre všetky 3 varianty) ---
  // ====================================================================

  // --- A: Logika špecifická pre WIZARD ---
  currentStep = signal<number>(1);
  selectedOperation = signal<OperationType>('korektura');
  operations = [
    { id: 'korektura', label: 'Iba opraviť preklepy a diakritiku' },
    { id: 'stylizacia', label: 'Preštylizovať text (zmeniť tón)' },
    { id: 'formatovanie', label: 'Zmeniť formát (Markdown, odseky...)' },
    { id: 'zhrnutie', label: 'Zhrnúť text' }
  ];
  
  goToStep(step: number): void {
    this.currentStep.set(step);
  }

  // --- B: Logika špecifická pre PRÍKAZOVÝ RIADOK ---
  commandString = signal<string>('profesionalny md-preformatovat');
  
  parseAndApplyCommand(): void {
    const command = this.commandString().toLowerCase();
    const parts = command.split(/\s+/);
    
    this.moods.forEach(m => m.checked = false);

    parts.forEach(part => {
      const moodToUpdate = this.moods.find(m => m.keywords.includes(part));
      if (moodToUpdate) {
        moodToUpdate.checked = true;
      }
    });
    this.onMoodChange();
  }

  // --- C: Logika špecifická pre KARTY (Tabs) ---
  activeTab = signal<TabType>('stylizacia');

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  // --- Spoločná UI funkcia pre resetovanie ---
  resetApp(): void {
    this.text.set('');
    this.raw_text.set('');
    this.instructions.set('');
    this.moods.forEach(m => m.checked = false);
    this.onMoodChange();
    this.store();
    
    this.currentStep.set(1);
    this.selectedOperation.set('korektura');
    this.commandString.set('');
    this.activeTab.set('stylizacia');
  }

  // ====================================================================
  // --- CORE METÓDY (spoločné pre všetky varianty) ---
  // ====================================================================

  async pasteFromClipboard() {
    try {
      // @ts-ignore
      const items: ClipboardItems = await navigator.clipboard.read?.();
      if (items && items.length) {
        const htmlItem = items.find(i => i.types?.includes('text/html'));
        if (htmlItem) {
          const blob = await htmlItem.getType('text/html');
          const html = await blob.text();
          this.text.set(this.td.turndown(html));
          return;
        }
      }
      const txt = await navigator.clipboard.readText();
      this.text.set(txt);
    } catch { }
  }

  async copyAsHtml(html: string) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })
    ]);
  }

  async copyAsRawText() {
    const text = this.raw_text() ?? '';
    await navigator.clipboard.write([ new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) }) ]);
  }

  onMoodChange() {
    const moods = this.moods.filter(i => i.checked).map(i => i.prompt);
    const txt = moods.length ? moods.join('\n') : '';
    this.moods_text.set(txt);
  }

  private store() {
    const data = { text: this.text(), instructions: this.instructions(), moods: this.moods };
    const str = JSON.stringify(data);
    localStorage.setItem('data', str);
  }

  async correctWithGemini() {
    const input = this.text()?.trim();
    if (!input || this.busy()) return;
    
    // Pre variant B, príkaz sa aplikuje tesne pred odoslaním
    // Ak by sme chceli interaktívnejšie, volalo by sa to pri zmene `commandString`
    // this.parseAndApplyCommand(); 
    
    const moods = this.moods_text()?.trim();
    const instruction = this.instructions()?.trim();
    const strs: String[] = [];
    if (moods) strs.push(moods);
    if (instruction) strs.push(instruction);
    const all_istructions = strs.join('\n');
    const temp = 0.3;
    this.busy.set(true);
    let resp: any;
    try {
      const apiBaseUrl = isDevMode() ? '' : this.service.url;
      const apiUrl = `${apiBaseUrl}/api/correct`;
      let isErr = false;
      resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, instruction: all_istructions, temperature: temp })
      }).catch((reason: any) => { isErr = true; });

      if (!isErr && resp.ok) {
        const { corrected } = await resp.json();
        if (typeof corrected === 'string' && corrected.trim().length > 0) {
          this.raw_text.set(corrected);
        }
        this.store();
        
        // Navigácia na ďalší krok platí len pre wizard a len ak je v kroku 3
        if (this.currentStep() === 3) {
            this.goToStep(4);
        }
      } else if (!isErr) {
        throw new Error('API error ' + resp.status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}