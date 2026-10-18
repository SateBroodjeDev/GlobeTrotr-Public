# 📦 Release principles / Releaseprincipes

Development and reviewed releases are separate. Maintainers complete changes,
run local tests and a production build, and review the exact release before
deployment. A source publication is not a deployment approval.

Deployment follows dependency order: compatible background processing is checked
before a web version that relies on it. Failed builds must preserve the running
version; failed activation requires recovery to a previously verified version.

Database changes, configuration and infrastructure maintenance require separate
owner review. Secrets are configured outside source control. Publishing source
does not grant access to deployment controls or allow bypassing authentication,
audit records or owner decisions.

Public viewing editions are exported without the private repository history or
internal operations documents. New editions are checked for accidental credentials
and confidential material. The public repository must not receive a normal merge
or mirror push from the private development repository, because that would expose
its history and excluded files.

## Nederlands

Een broncodepublicatie is geen productie-uitrol. De beheerder controleert de
exacte release, tests, afhankelijkheden en herstelmogelijkheden. Database- en
infrastructuurwijzigingen vragen afzonderlijke beoordeling. Geheimen blijven
buiten Git. Deel een gecontroleerde export, nooit de private Git-geschiedenis.
