#!/usr/bin/env python3
import re

p = '/root/kontraktor/src/routes/admin/email.ts'
with open(p, 'r') as f:
    s = f.read()

# 1) Fix mini reply wrong literal
s = s.replace("}).(info) => {", ").then((info: SentMessageInfo) => {")
# 2) Fix transporter -> createTransporter()
s = s.replace("transporter.sendMail({", "createTransporter().sendMail({")

# 3) Ensure info: SentMessageInfo on promise
s = s.replace(
    "}).then((info: SentMessageInfo) => {",
    "}).then((info: import('nodemailer').SentMessageInfo) => {"
)

# 4) Cheap lint-pass: strip the pre-existing duplicates caused by sed over read+write
# Replace duplicate imports blocks:
s = s.replace(
    "import makeT, getPagination, localizedName, PAGE_SIZE, csvUpload from './helpers';\nimport makeT, getPagination, localizedName, PAGE_SIZE, csvUpload from './helpers';",
    "import { makeT, getPagination, localizedName, PAGE_SIZE, csvUpload } from './helpers';",
    1,
)

with open(p, 'w') as f:
    f.write(s)

print('done')
