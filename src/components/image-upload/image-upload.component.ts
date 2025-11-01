import { Component, ChangeDetectionStrategy, output, input } from '@angular/core';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ImageUploadComponent {
  imageSelected = output<string>();
  disabled = input<boolean>(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        // e.target.result contains the base64 string
        const base64String = e.target.result.split(',')[1];
        this.imageSelected.emit(base64String);
      };
      reader.readAsDataURL(file);
    }
  }
}
