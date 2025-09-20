import { Component, signal, computed, effect, OnInit, inject, isDevMode, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { AppService } from './app.service';


@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  service: AppService = inject(AppService);
  text = signal('ahoj jakso mas? dneska som bol v obchode a kupil som chlieb a rohliky ale predavacka bola dost neochotna a vravela ze nema vydavok. tiez som zabudol kupit mlieko co ma dost stvalo lebo deti budu chcet kakao. mozno zajtra pojdem zase do obchodu ked budem mat cas.');
  raw_text = signal('')
  instructions = signal('');
  moods_text = signal('');
  moods = [
    { name: 'Profesionálny', checked: true, prompt: 'Použi neutrálny, formálny a profesionálny štýl.', col: 1 },
    { name: 'Priateľský', checked: false, prompt: 'Použi priateľský, hovorový tón.', col: 1 },
    { name: 'Veselý', checked: false, prompt: 'Použi veselý a pozitívny tón, pridaj ľahkosť do textu.', col: 1 },
    { name: 'Odmeraný', checked: false, prompt: 'Použi strohý, faktický tón bez emócií.', col: 1 },



    { name: 'Stručný', checked: false, prompt: 'Zjednoduš a skráť vety, vyjadruj sa čo najstručnejšie.', col: 2 },
    { name: 'Detailný', checked: false, prompt: 'Rozviň text, doplň detaily a vysvetlenia.', col: 2 },
    { name: 'Zhrnutie', checked: false, prompt: 'Zhrň text do maximálne 3 viet.', col: 2 },
    { name: 'Bullet list', checked: false, prompt: 'Rozdeľ obsah do odrážok pre lepšiu čitateľnosť.', col: 2 },
    { name: 'Odseky', checked: false, prompt: 'Rozdeľ text do prehľadných odsekov.', col: 2 },

    { name: 'Email', checked: false, prompt: 'Premeň text na formálny e-mail vhodný na odoslanie.', col: 3 },
    { name: 'SMS', checked: false, prompt: 'Premeň text na krátku SMS správu, údernú a bez omáčok.', col: 3 },
    { name: 'Kreatívny', checked: false, prompt: 'Preformuluj text do tvorivého štýlu: používaj expresívne a obrazné vyjadrenia, pridaj hravosť a originalitu.', col: 3 },

    { name: 'Md - zachovať', checked: false, prompt: 'Zachovaj pôvodné Markdown formátovanie textu bez zmien.', col: 4 },
    { name: 'Md - preformátovať', checked: false, prompt: 'Naformátuj text do čitateľného Markdownu (nadpisy, odseky, odrážky).', col: 4 },
    { name: 'Md - odrážky', checked: false, prompt: 'Preveď dlhšie zoznamy alebo vety na Markdown bullet list.', col: 4 },
    { name: 'Md - číslovaný zoznam', checked: false, prompt: 'Premeň kroky alebo postup na očíslovaný Markdown zoznam.', col: 4 },
    { name: 'Md - tabuľka', checked: false, prompt: 'Preveď štruktúrované údaje do Markdown tabuľky.', col: 4 }
  ]



  busy = signal(false);
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });




  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.raw_text() ?? '', { async: false }) as string; // ← dôležité
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    this.cleanHtmlStr = clean;
    this.htmlr = this.sanitizer.bypassSecurityTrustHtml(clean);
    return this.htmlr;
  });
  cols: any[][];
  cleanHtmlStr: string = '';
  htmlr!: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {
    this.cols = this.moods.reduce(
      (a, m) => (a[m.col - 1].push(m), a),
      [[], [], [], []] as any[][]
    );
  }

  ngOnInit(): void {
    this.onMoodChange();
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

  async copyAsHtml(html: string) {

    console.log('defr', html);


    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })
    ]);
  }


  async copyAsRawText() {


    console.log('raw', this.raw_text());


    const text = this.raw_text() ?? '';
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ]);

  }


  async correctWithGemini(mode: string = '') {

    const input = this.text()?.trim();
    if (!input || this.busy()) return;
    const moods = this.moods_text()?.trim();
    const instruction = this.instructions()?.trim();
    const strs: String[] = [];
    if (moods) {
      strs.push(moods);
    }
    if (instruction) {
      strs.push(instruction);
    }

    const all_istructions = strs.join('\n');

    this.busy.set(true);
    let resp: any;
    try {

      const apiBaseUrl = isDevMode() ? '' : this.service.url;

      const apiUrl = `${apiBaseUrl}/api/correct`;
      let isErr = false;
      resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, instruction: all_istructions })


      })
        .catch((reason: any) => {

          isErr = true;
          console.log('exception', reason);


        }).finally(() => {
          this.busy.set(false);
          console.log(resp);

        });

      console.log(`all_istructions: ${all_istructions}`);
      if (!isErr) {
        if (!resp.ok) throw new Error('API error ' + resp.status);
        const { corrected } = await resp.json();
        if (typeof corrected === 'string' && corrected.trim().length > 0) {
          this.raw_text.set(corrected);
        }
      }
    } catch (e) {
      console.error(e);
      // necháme pôvodný text; prípadne toast/alert
    } finally {
      this.busy.set(false);
    }
  }

  onMoodChange() {
    const moods = this.moods.filter(i => i.checked).map(i => i.prompt);
    console.log(moods)
    const txt = moods.length ? moods.join('\n') : '';
    this.moods_text.set(txt);

  }




}
