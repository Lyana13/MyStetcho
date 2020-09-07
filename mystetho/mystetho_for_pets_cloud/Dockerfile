FROM ubuntu:18.04
ENV DEBIAN_FRONTEND nonineractive

RUN apt update && \
apt upgrade -y && \
apt install python3 python3-pip python3-dev -y
RUN pip3 install --upgrade pip

RUN apt install libopus-dev libvpx-dev libffi-dev libssl-dev libavdevice-dev libopencv-dev libavfilter-dev pkg-config ffmpeg git -y

RUN mkdir /root/work
WORKDIR /root/work/

RUN git clone https://github.com/jfsantos/SRMRpy.git

RUN pip install aiohttp

RUN pip install git+https://github.com/detly/gammatone.git
RUN cd SRMRpy && python3 setup.py install && cd ..

ADD requirements.txt .
RUN pip3 install -r requirements.txt

ADD . .

# LOCAL
 EXPOSE 8080
 CMD [ "python3", "server_spectrogram.py" ]

# SERVER
#CMD gunicorn server_spectrogram:app --bind 0.0.0.0:$PORT --worker-class aiohttp.worker.GunicornWebWorker
