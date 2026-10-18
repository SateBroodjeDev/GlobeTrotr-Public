# 🔐 Security / Beveiliging

## Report privately

Do not post credentials, personal data or exploit details in public issues or
pull requests. Use GitHub's private vulnerability-reporting option if available.
Otherwise use the contact route on [globetrotr.nl](https://globetrotr.nl) to ask
for a private reporting channel before sharing sensitive details.

Provide an affected version, impact and minimal reproduction with synthetic data.
Only test systems you are authorised to test. This publication grants no access
or testing permission for hosted services.

## General boundaries

Browser code must never receive privileged server credentials. Server handlers
enforce authentication and resource access; database grants and row-level
security remain separate controls. Public source does not replace those controls.

No production credentials are provided. Example configuration uses placeholders.
Private infrastructure, incident records and recovery procedures are intentionally
outside this publication. The presence of source and documentation is not a
security certification or a guarantee that every possible vulnerability is absent.

Third-party dependencies need continuing maintenance. Security changes are reviewed
and tested in the private development repository before a new viewing edition.

## Nederlands

Meld kwetsbaarheden privé. Plaats geen geheimen, persoonsgegevens of exploituitleg
in openbare issues. Vraag via de website om een veilig meldkanaal als privé melden
via GitHub niet beschikbaar is. Test alleen systemen waarvoor je toestemming hebt.

Deze publicatie bevat geen productiecredentials of interne herstelprocedures.
Publieke broncode geeft geen toegang tot accounts of infrastructuur en is geen
garantie dat alle mogelijke beveiligingsproblemen uitgesloten zijn.
