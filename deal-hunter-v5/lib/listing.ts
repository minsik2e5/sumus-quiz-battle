export function actualListingPhotos<T extends {kind?:string}>(photos:T[]):T[] {
  return photos.filter(photo=>photo.kind!=='reference');
}
export function listingPhotoNames(id:string,photos:{name:string;type:string;key?:string;url?:string;data?:string;kind?:string}[]) {
  const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  return photos.map((photo,index)=>{
    if(photo.kind==='reference')throw new Error('제품 참고사진은 실물 등록사진에서 제외해 주세요.');
    if(!ext[photo.type]||!photo.key&&!photo.url&&!photo.data)throw new Error('실제 사진 파일을 확인해 주세요.');
    return `${id.replace(/[^0-9A-Za-z가-힣_-]/g,'_')}-${String(index+1).padStart(2,'0')}.${ext[photo.type]}`;
  });
}
