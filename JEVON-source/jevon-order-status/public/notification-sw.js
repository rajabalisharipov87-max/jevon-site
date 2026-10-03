self.addEventListener('push',event=>{
  event.waitUntil(self.registration.showNotification('JEVON · Статус заказов',{
    body:'Есть обновление по заказам вашего отдела. Откройте сайт, чтобы посмотреть.',
    icon:'/favicon.ico',tag:'jevon-order-update',renotify:true,data:{url:'/legacy'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=new URL('/legacy',self.location.origin).href;
    const clientsList=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=clientsList.find(item=>item.url.startsWith(self.location.origin));
    if(client){await client.focus();client.navigate(url)}else await self.clients.openWindow(url);
  })());
});
