import { HttpClient, provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection, isDevMode, provideAppInitializer, inject, InjectionToken } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { firstValueFrom, tap } from 'rxjs';
import { AppService } from './app.service';


export const appConfig: ApplicationConfig = {
  providers: [
      provideZoneChangeDetection({ eventCoalescing: true }), 
      provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
      provideHttpClient(),
      AppService,
      provideAppInitializer(() => {
      const http = inject(HttpClient);
      const appService = inject(AppService);
      return firstValueFrom(
        http.get("config.json")
          .pipe(tap(cf => { 
            const acf = cf as any;
            appService.url = acf.url;
            console.log(`url: ${appService.url}`);
           }))
      );
    })
        ]
};
