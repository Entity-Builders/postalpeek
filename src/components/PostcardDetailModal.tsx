import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@entity-builders/logic/src/supabase';
import { Postcard } from './Postcard';
import type { FeedItem } from './Postcard';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';
import { useNavigate } from 'react-router-dom';

interface PostcardDetailModalProps {
  item: FeedItem;
  onClose: () => void;
  onExpandImage?: (item: FeedItem, sourceRect?: DOMRect) => void;
}

type ValidationState = 'idle' | 'analyzing' | 'success' | 'error';

export function PostcardDetailModal({ item, onClose, onExpandImage }: PostcardDetailModalProps) {
  const lang = useLang();
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationReason, setValidationReason] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleValidateIRL = async () => {
    try {
      // 1. Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert(t({ es: 'Necesitamos acceso a la cámara para validar tu postal en el mundo real.', en: 'We need camera access to validate your postcard in the real world.' }, lang));
        return;
      }

      analytics.track('validate_irl_button_clicked', { postcard_id: item.id });

      // 2. Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // User cancelled
      }

      const base64Image = result.assets[0].base64;
      if (!base64Image) {
        throw new Error(t({ es: 'No se pudo procesar la imagen.', en: 'The image could not be processed.' }, lang));
      }

      setValidationState('analyzing');
      setValidationReason(null);

      // 3. Get User ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authentication session found.');

      // 4. Call Edge Function
      const { data, error } = await supabase.functions.invoke('validate-location', {
        body: {
          userId: user.id,
          postcardId: item.id,
          userImageBase64: `data:image/jpeg;base64,${base64Image}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success && data.match) {
        setValidationState('success');
        setValidationReason(data.reasoning);
        analytics.track('validate_irl_success', { postcard_id: item.id });
      } else {
        setValidationState('error');
        setValidationReason(data.reasoning || data.error);
        analytics.track('validate_irl_failed', { postcard_id: item.id });
      }

    } catch (err: any) {
      console.error('Validation error:', err);
      setValidationState('error');
      setValidationReason(err.message || t({ es: 'Ocurrió un error al analizar la foto.', en: 'An error occurred while analyzing the photo.' }, lang));
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-[#e6e2da] overflow-hidden flex flex-col"
      initial={{ opacity: 0, y: '20%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 flex flex-col items-center pt-2">
        {/* Postcard Container */}
        <div className="w-full max-w-sm aspect-[3/4] relative mb-6">
          <Postcard
            item={item}
            isActive={true}
            onExpandImage={onExpandImage}
            onOpenAlbum={(albumId) => {
              navigate(`/album/${albumId}`);
              onClose();
            }}
          />
        </div>

        {/* IRL Validation Section */}
        <div className="w-full max-w-sm mt-4 text-center pb-10">
          <AnimatePresence mode="wait">
            {validationState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/70 p-5 rounded-2xl shadow-sm border border-stone-200"
              >
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-6 h-6 text-stone-600" />
                </div>
                <h3 className="font-serif text-lg text-stone-800 mb-2">{t({ es: 'Validación en el Mundo Real', en: 'Real World Validation' }, lang)}</h3>
                <p className="text-sm text-stone-500 mb-4 px-2">
                  {t({ es: `¿Estás en ${item.city} o en un lugar que transmite esta vibra? Sacate una foto y ganá estampillas.`, en: `Are you in ${item.city} or a place that gives off this vibe? Take a photo and earn stamps.` }, lang)}
                </p>
                <button
                  onClick={handleValidateIRL}
                  className="w-full py-3.5 bg-stone-800 text-white rounded-full font-medium shadow-md shadow-stone-800/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {t({ es: 'Tomar foto', en: 'Take photo' }, lang)}
                </button>
              </motion.div>
            )}

            {validationState === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/70 p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col items-center"
              >
                <Loader2 className="w-10 h-10 text-stone-400 animate-spin mb-4" />
                <h3 className="font-serif text-base text-stone-700 mb-1">{t({ es: 'El Walker está evaluando...', en: 'Walker is evaluating...' }, lang)}</h3>
                <p className="text-sm text-stone-400 italic">"{t({ es: 'Analizando luces, ambiente...', en: 'Analyzing lights, ambiance...' }, lang)}"</p>
              </motion.div>
            )}

            {validationState === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-emerald-50/80 p-6 rounded-2xl shadow-sm border border-emerald-200 flex flex-col items-center"
              >
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="font-serif text-lg text-emerald-800 mb-2">{t({ es: '¡Validación Exitosa!', en: 'Successful Validation!' }, lang)}</h3>
                <p className="text-sm text-emerald-600/80 mb-4">
                  {validationReason}
                </p>
                <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-medium text-sm border border-emerald-200 mb-4 animate-bounce">
                  {t({ es: '+1 Estampilla Ganada', en: '+1 Stamp Earned' }, lang)}
                </div>
                <button
                  onClick={() => setValidationState('idle')}
                  className="text-emerald-700 text-sm font-medium hover:underline"
                >
                  {t({ es: 'Validar otra vez', en: 'Validate again' }, lang)}
                </button>
              </motion.div>
            )}

            {validationState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-rose-50/80 p-6 rounded-2xl shadow-sm border border-rose-200 flex flex-col items-center"
              >
                <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mb-3">
                  <XCircle className="w-6 h-6 text-rose-500" />
                </div>
                <h3 className="font-serif text-lg text-rose-800 mb-2">{t({ es: 'Mmm, no parece ser el lugar', en: 'Mmm, doesn\'t look like the place' }, lang)}</h3>
                <p className="text-sm text-rose-600/80 mb-5">
                  {validationReason}
                </p>
                <button
                  onClick={() => setValidationState('idle')}
                  className="px-6 py-2.5 bg-white text-rose-600 border border-rose-200 rounded-full font-medium text-sm"
                >
                  {t({ es: 'Intentar otra foto', en: 'Try another photo' }, lang)}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
