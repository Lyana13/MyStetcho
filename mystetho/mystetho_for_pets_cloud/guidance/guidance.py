import keras
from keras.models import load_model
import numpy as np
from scipy.ndimage.interpolation import zoom
from scipy.signal import lfilter, hamming
from scipy.fftpack import fft
from scipy.fftpack.realtransforms import dct
from srmrpy.segmentaxis import segment_axis
from collections import Counter
import numpy

def normalize_audio(audio, fs):
	return zoom([audio, audio], (1.0, 4000.0 / float(fs)))[0]


def trfbank(fs, nfft, lowfreq, linsc, logsc, nlinfilt, nlogfilt):
	nfilt = nlinfilt + nlogfilt
	freqs = np.zeros(nfilt + 2)
	freqs[:nlinfilt] = lowfreq + np.arange(nlinfilt) * linsc
	freqs[nlinfilt:] = freqs[nlinfilt - 1] * logsc ** np.arange(1, nlogfilt + 3)
	heights = 2. / (freqs[2:] - freqs[0:-2])

	fbank = np.zeros((nfilt, nfft))
	nfreqs = np.arange(nfft) / (1. * nfft) * fs
	for i in range(nfilt):
		low = freqs[i]
		cen = freqs[i + 1]
		hi = freqs[i + 2]
		lid = np.arange(np.floor(low * nfft / fs) + 1,
						np.floor(cen * nfft / fs) + 1, dtype=np.int)
		lslope = heights[i] / (cen - low)
		rid = np.arange(np.floor(cen * nfft / fs) + 1,
						np.floor(hi * nfft / fs) + 1, dtype=np.int)
		rslope = heights[i] / (hi - cen)
		fbank[i][lid] = lslope * (nfreqs[lid] - low)
		fbank[i][rid] = rslope * (hi - nfreqs[rid])
	return fbank, freqs

def mfcc(input, nlinfil = 1, nlogfil = 19, linsc = 150, logsc = 1.2):
	prefac = 0.97
	lowfreq = 133.33
	# linsc = 150
	# logsc = 1.2
	# nlinfil = 1
	# nlogfil = 19
	nfft = 1024 * 2
	nwin = 300
	over = 100
	fs = 16000 * 0.7

	w = hamming(nwin, sym=0)
	fbank = trfbank(fs, nfft, lowfreq, linsc, logsc, nlinfil, nlogfil)[0]
	extract = preemp(input, prefac)
	framed = segment_axis(a=extract, length=nwin, overlap=over) * w
	spec = np.abs(fft(framed, nfft, axis=-1))
	mspec = np.log10(np.dot(spec, fbank.T))
	return mspec


def preemp(input, p):
	return lfilter([1., -p], 1, input)



class GuidanceController:

	def load_model(self):
		self.model = load_model("guidance/guidance_model.h5")

	def release_model(self):
		keras.backend.clear_session()
		del self.model

	def predict_item(self, audio, fs):
		audio = normalize_audio(audio, fs)
		spectrogram = mfcc(input=audio)
		spectrogram = np.transpose(np.fliplr(spectrogram))
		spectrogram = np.array(spectrogram, dtype=float)
		spectrogram -= np.mean(spectrogram)
		spectrogram /= np.std(spectrogram)
		spectrogram = spectrogram.reshape(1, np.shape(spectrogram)[0], np.shape(spectrogram)[1], 1)
		prediction = self.model.predict(spectrogram, batch_size=1)
		return prediction

	def spectrogram(self, audio, fs):
		audio = normalize_audio(audio, fs)
		spectrogram = mfcc(input=audio)
		spectrogram = np.transpose(np.fliplr(spectrogram))
		spectrogram = np.array(spectrogram, dtype=float)
		spectrogram -= np.min(spectrogram)
		spectrogram /= np.max(spectrogram)
		spectrogram *= 255
		return spectrogram
