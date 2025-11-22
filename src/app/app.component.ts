import { Component, signal, computed, effect, OnInit, inject, isDevMode, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import { AppService } from './app.service';
import { Form3Component } from './form3/form3.component';
import { Form4Component } from './form4/form4.component';


interface SwitchOption {
  label: string;
  value: string;
  description: string;
  checked: boolean;
}



@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule, Form4Component],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  readonly switches: SwitchOption[] = [
    { label: 'Oprava preklepov', value: 'fix', description: 'Oprav preklepy a diakritiku.', checked: true },
    { label: 'Profesionálny', value: 'professional', description: 'Použi neutrálny, formálny a profesionálny štýl.', checked: false },
    { label: 'Priateľský', value: 'friendly', description: 'Použi priateľský, hovorový tón.', checked: true },
    { label: 'Prelož do angličtiny', value: 'toen', description: 'Prelož do angličtiny.', checked: false },
    { label: 'Prelož do slovenčiny', value: 'tosk', description: 'Prelož do slovenčiny.', checked: false },

  ];


  service: AppService = inject(AppService);
  inputText = signal<string>('');
  rawOutput = signal<string>('');
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);


  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.rawOutput() ?? '', { async: false }) as string;
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });


  constructor(private sanitizer: DomSanitizer) {
    const str = localStorage.getItem('data');
    if (str) {
      try {
        const data = JSON.parse(str);
        this.inputText.set(data.text);
        // const smoods = data.moods as SwitchGroup[];
        // if (smoods) {
        //   smoods.forEach(gTemp => {
        //     gTemp.options.forEach(optTemp => {
        //       if (optTemp.checked) {

        //         this.switchGroups.forEach(gx => {
        //           if (gx.name === gTemp.name) {
        //             this.onSelectionChange(gx, optTemp.value);
        //           }
        //         });
        //       }
        //     })
        //   });
        // }

      } catch (error) {
        console.log(error);
      }
    }
  }

  ngOnInit(): void {
  }


  handleClear(): void {
    this.inputText.set('');
    this.rawOutput.set('');
    this.store();
  }

  async handlePaste() {
    try {
      // @ts-ignore
      const items: ClipboardItems = await navigator.clipboard.read?.();
      if (items && items.length) {
        const htmlItem = items.find(i => i.types?.includes('text/html'));
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

  async copyAsHtml(html: string) {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })
    ]);
  }

  async copyAsRawText() {
    const text = this.rawOutput() ?? '';
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
  }

  private store() {
    const data = { text: this.inputText(), moods: this.switches };
    const str = JSON.stringify(data);
    localStorage.setItem('data', str);
  }


  onSelectionChange(optValue: string) {
    // o.checked = o.value === optValue;

  }

  async handleGenerate() {
    const input = this.inputText()?.trim();
    if (!input || this.isLoading()) return;

    const mds: string[] = [];
    // this.switchGroups.forEach(g => {
    //   g.options.forEach(o => {
    //     if (o.checked) {
    //       mds.push(o.description);
    //     }
    //   })
    // });

    const strs: String[] = [];
    if (mds) strs.push(mds.join('\n'));
    const all_istructions = strs.join('\n');
    const temp = 0.3;
    this.isLoading.set(true);
    let resp: any;
    try {
      const apiBaseUrl = isDevMode() ? '' : this.service.url;
      const apiUrl = `${apiBaseUrl}/api/correct`;
      let isErr = false;
      const body = JSON.stringify({ text: input, instruction: all_istructions, temperature: temp });
      console.log(body);

      resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      }).catch((reason: any) => { isErr = true; });

      if (!isErr && resp.ok) {
        const { corrected } = await resp.json();
        if (typeof corrected === 'string' && corrected.trim().length > 0) {
          this.rawOutput.set(corrected);
        }
        this.store();

      } else if (!isErr) {
        throw new Error('API error ' + resp.status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  handleCopy(arg0: any) {

  }


}