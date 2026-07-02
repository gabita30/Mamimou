'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = 'BPCFgOOG0kXxVLxxh3jo-OYSHJ-w7Xdlr7gecdnavX1aJ6cepUdhVHfTQIHvB1KlJltUT7VH-i0yPxathvGeJgM'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useNotificationPrompt() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setIsSupported(supported)
    if (!supported) return

    setPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(!!subscription)
      })
      .catch((err) => {
        console.error('Erreur lors de la vérification de l\'abonnement push :', err)
      })
  }, [])

  const promptSubscribe = useCallback(async () => {
    if (!isSupported || isLoading) return

    setIsLoading(true)
    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== 'granted') {
        setIsLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const subJson = subscription.toJSON()
      const { error } = await supabase.rpc('upsert_push_subscription', {
        p_endpoint: subJson.endpoint,
        p_p256dh: subJson.keys?.p256dh,
        p_auth: subJson.keys?.auth,
        p_user_agent: navigator.userAgent,
      })

      if (error) {
        console.error('Erreur lors de l\'enregistrement de l\'abonnement :', error.message)
      } else {
        setIsSubscribed(true)
      }
    } catch (err) {
      console.error('Erreur lors de l\'abonnement aux notifications :', err)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, isLoading])

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    // Le bouton doit s'afficher : navigateur compatible, pas encore abonné,
    // et l'utilisateur n'a pas explicitement refusé la permission.
    isSubscribable: isSupported && !isSubscribed && permission !== 'denied',
    promptSubscribe,
  }
}
