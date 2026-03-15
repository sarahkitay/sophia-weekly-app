declare module "adm-zip" {
  class AdmZip {
    constructor(buffer?: Buffer);
    getEntries(): { entryName: string; getData(): Buffer; isDirectory: boolean }[];
    getEntry(name: string): { entryName: string; getData(): Buffer; isDirectory: boolean } | null;
  }
  export = AdmZip;
}
