import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Form4Component } from './form4/form4.component';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';



@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, Form4Component],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(private swUpdate: SwUpdate) {}

  ngOnInit(): void {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        if (confirm('Je dostupná nová verzia aplikácie. Chcete ju načítať?')) {
          document.location.reload();
        }
      });
    }
  }

}