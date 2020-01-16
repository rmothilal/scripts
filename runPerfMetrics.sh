
unzip ../${DATE}/${DATE}T${TIME}-out.zip

nohup node --max-old-space-size=4096 loadTestingParserWithoutMock.js -n 14 -f ../${DATE}/${DATE}T${TIME}-out.txt > ../${DATE}/${DATE}T${TIME}-withoutMock.txt &

nohup node --max-old-space-size=4096 loadTestingParserWithMock.js -n 14 -f ../${DATE}/${DATE}T${TIME}-out.txt > ../${DATE}/${DATE}T${TIME}-withMock.txt &

sleep 3

tail -f ../${DATE}/${DATE}T${TIME}-withoutMock.txt ../${DATE}/${DATE}T${TIME}-withMock.txt


