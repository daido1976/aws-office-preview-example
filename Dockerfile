# clone from https://github.com/shelfio/libreoffice-lambda-base-image/blob/master/Dockerfile.node20-x86_64
FROM public.ecr.aws/lambda/nodejs:20-x86_64

ENV PATH=/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin

# Configure linker to correctly point to libraries
ENV LD_LIBRARY_PATH="/usr/lib:/usr/lib64"
RUN dnf install -y xorg-x11-fonts-* libSM.x86_64 libXinerama-devel google-noto-sans-cjk-fonts google-noto-emoji-color-fonts binutils tar gzip xz \
  openssl nss-tools dbus-libs cups-libs libxslt && dnf clean all

RUN cp /lib64/libssl.so.3 /lib64/libssl3.so

RUN mkdir ~/libre && cd ~/libre && curl -s -L https://download.documentfoundation.org/libreoffice/stable/24.8.2/rpm/x86_64/LibreOffice_24.8.2_Linux_x86-64_rpm.tar.gz | tar xvz

RUN cd ~/libre/LibreOffice_24.8.2.1_Linux_x86-64_rpm/RPMS/ && rpm -Uvh *.rpm && rm -fr ~/libre

RUN ln -s /opt/libreoffice24.8/program/soffice /usr/local/bin/soffice

ENV HOME=/tmp

# Trigger dummy run to generate bootstrap files to improve cold start performance
RUN touch /tmp/test.txt \
  && cd /tmp \
  && soffice --headless --invisible --nodefault --view \
  --nolockcheck --nologo --norestore --convert-to pdf \
  --outdir /tmp /tmp/test.txt \
  && rm /tmp/test.*

# clone from https://github.com/shelfio/libreoffice-lambda-base-image/blob/master/Dockerfile.node20-x86_64

COPY ./ ${LAMBDA_TASK_ROOT}/

RUN npm install

ENV LO_BINARY_PATH=soffice

CMD [ "for-local.handler" ]
