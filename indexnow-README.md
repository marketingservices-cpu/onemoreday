# IndexNow key

`edf99940105329e9e4be0f468945efc3.txt` is an IndexNow verification key. It must stay at the site root and
its filename must match its contents — that pair is how Bing proves whoever
submitted a URL controls the domain.

Submitting through IndexNow needs no account and no sign-in, which is why it is
here: it reaches Bing (and Yandex, and anything else on the protocol) without
waiting on a console login. Google does not participate — Google needs Search
Console, which needs a person.

Resubmit after a meaningful content change:

    curl -s -X POST https://api.indexnow.org/indexnow \
      -H 'Content-Type: application/json' \
      -d '{"host":"onemoredaybook.com","key":"edf99940105329e9e4be0f468945efc3","keyLocation":"https://onemoredaybook.com/edf99940105329e9e4be0f468945efc3.txt","urlList":["https://onemoredaybook.com/"]}'
