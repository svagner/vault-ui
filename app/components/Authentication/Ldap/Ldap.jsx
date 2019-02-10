import React from 'react';
import PropTypes from 'prop-types';
// Material UI
import Dialog from 'material-ui/Dialog';
import TextField from 'material-ui/TextField';
import Checkbox from 'material-ui/Checkbox'
import { Tabs, Tab } from 'material-ui/Tabs';
import Paper from 'material-ui/Paper';
import { List } from 'material-ui/List';
import FlatButton from 'material-ui/FlatButton';
import { Toolbar, ToolbarGroup } from 'material-ui/Toolbar';
import Subheader from 'material-ui/Subheader';

// Styles
import styles from './ldap.css';
import sharedStyles from '../../shared/styles.css';
// Misc
import _ from 'lodash';
import update from 'immutability-helper';
import ItemPicker from '../../shared/ItemPicker/ItemPicker.jsx'
import { callVaultApi, tokenHasCapabilities, history } from '../../shared/VaultUtils.jsx';
import ItemList from '../../shared/ItemList/ItemList.jsx';

function snackBarMessage(message) {
    document.dispatchEvent(new CustomEvent('snackbar', { detail: { message: message } }));
}

export default class LdapAuthBackend extends React.Component {
    static propTypes = {
        params: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired
    };

    backendConfigSchema = {
        binddn: '',
        bindpass: '',
        url: undefined,
        groupattr: '',
        groupfilter: '',
        insecure_tls: undefined,
        starttls: undefined,
        tls_max_version: '',
        tls_min_version: '',
        userattr: '',
        userdn: ''
    }

    itemConfigSchema = {
        id: '',
        policies: []
    }

    constructor(props) {
        super(props);
        this.state = {
            baseUrl: `/auth/ldap/${this.props.params.namespace}/`,
            baseVaultPath: `auth/${this.props.params.namespace}`,
            groups: [],
            config: this.backendConfigSchema,
            newConfig: this.backendConfigSchema,
            itemConfig: this.teamConfigSchema,
            selectedItemId: '',
            newItemId: '',
            isBackendConfigured: false,
            openItemDialog: false,
            selectedTab: 'groups',
            deleteUserPath: ''
        };

        _.bindAll(
            this,
            'listLdapGroups',
            'getLdapConfig',
            'displayItem'
        );
    }

    listLdapGroups() {
        tokenHasCapabilities(['list'], `${this.state.baseVaultPath}/groups`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/groups`, { list: true }, null)
                    .then((resp) => {
                        let groups = _.get(resp, 'data.data.keys', []);
                        this.setState({ groups: _.valuesIn(groups) });
                    })
                    .catch((error) => {
                        if (error.response.status !== 404) {
                            snackBarMessage(error);
                        } else {
                            this.setState({ groups: [] });
                        }
                    });
            })
            .catch(() => {
                snackBarMessage(new Error('Access denied'));
            })
    }

    getLdapConfig() {
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/config`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/config`, null, null)
                    .then((resp) => {
                        let config = _.get(resp, 'data.data', this.backendConfigSchema);
                        if (!config.url) {
                            history.push(`${this.state.baseUrl}backend`);
                            this.setState({ selectedTab: 'backend', isBackendConfigured: false, newConfig: this.backendConfigSchema });
                            snackBarMessage(new Error(`This backend has not yet been configured`));
                        } else {
                            this.setState({
                                config: config,
                                newConfig: config,
                                isBackendConfigured: true
                            });
                        }
                    })
                    .catch((error) => {
                        if (error.response.status !== 404) {
                            snackBarMessage(error);
                        } else {
                            error.message = `This backend has not yet been configured`;
                            history.push(`${this.state.baseUrl}backend`);
                            snackBarMessage(error);
                        }
                    });
            })
            .catch(() => {
                snackBarMessage(new Error('Access denied'));
            })
    }

    displayItem() {
        let itemId = this.state.selectedTab;
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/${this.state.selectedItemId}`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/${this.state.selectedItemId}`, null, null, null)
                    .then((resp) => {
                        let item = _.get(resp, 'data.data', {});
                        item.id = itemId;

                        let policies = _.get(item, 'policies', undefined);
                        item.policies = policies ? policies : [];

                        this.setState({ itemConfig: item, openItemDialog: true });
                    })
                    .catch(snackBarMessage)
            })
            .catch(() => {
                this.setState({ selectedItemId: '' })
                snackBarMessage(new Error(`No permissions to display properties for ${itemId} ${this.state.selectedItemId}`));
            })
    }

    createUpdateConfig() {
        callVaultApi('post', `${this.state.baseVaultPath}/config`, null, this.state.newConfig)
            .then(() => {
                snackBarMessage(`Backend ${this.state.baseVaultPath}/config has been updated`);
                this.setState({ isBackendConfigured: this.state.newConfig.url, config: this.state.newConfig });
            })
            .catch(snackBarMessage);
    }

    createUpdateItem(id) {
        tokenHasCapabilities(['create', 'update'], `${this.state.baseVaultPath}/${id}`)
            .then(() => {
                let updateObj = _.clone(this.state.itemConfig);
                updateObj.policy = this.state.itemConfig.policies.join(',');
                callVaultApi('post', `${this.state.baseVaultPath}/${id}`, null, updateObj)
                    .then(() => {
                        snackBarMessage(`LDAP ${this.state.selectedTab.substring(0, this.state.selectedTab.length - 1)} ${id.split('/')[1]} has been updated`);
                        this.listLdapGroups();
                        this.setState({ openItemDialog: false, openNewItemDialog: false, itemConfig: _.clone(this.itemConfigSchema), selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    })
                    .catch(snackBarMessage);
            })
            .catch(() => {
                this.setState({ selectedRoleId: '' })
                snackBarMessage(new Error(`No permissions to display properties for role ${id}`));
            })
    }
    componentWillMount() {
        let tab = this.props.location.pathname.split(this.state.baseUrl)[1];
        if (!tab) {
            history.push(`${this.state.baseUrl}${this.state.selectedTab}/`);
        } else {
            this.setState({ selectedTab: tab.includes('/') ? tab.split('/')[0] : tab });
        }
    }

    componentDidMount() {
        this.listLdapGroups();
        this.getLdapConfig();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.selectedItemId !== prevState.selectedItemId) {
            this.listLdapGroups();
            if (this.state.selectedItemId) {
                let params = this.state.selectedItemId.split('/');
                if (params.length > 0) {
                    this.setState({ selectedTab: params[0] });
                    if (params.length > 1 && params[1]) {
                        this.displayItem();
                    }
                }
            }
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!_.isEqual(this.props.params.namespace, nextProps.params.namespace)) {
            // Reset
            this.setState({
                baseUrl: `/auth/ldap/${nextProps.params.namespace}/`,
                baseVaultPath: `auth/${nextProps.params.namespace}`,
                groups: [],
                selectedItemId: '',
                newConfig: this.backendConfigSchema,
                config: this.backendConfigSchema,
                selectedTab: 'groups',
                isBackendConfigured: false
            }, () => {
                history.push(`${this.state.baseUrl}groups`);
                this.listLdapGroups();
                this.getLdapConfig();
            });
        }
    }

    render() {
        let renderPolicyDialog = () => {
            const actions = [
                <FlatButton
                    label='Cancel'
                    onTouchTap={() => {
                        this.setState({ openItemDialog: false, selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label='Save'
                    primary={true}
                    onTouchTap={() => {
                        this.createUpdateItem(this.state.selectedItemId);
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Editing LDAP ${this.state.selectedTab.substring(0, this.state.selectedTab.length - 1)} '${this.state.selectedItemId}'`}
                    modal={false}
                    actions={actions}
                    open={this.state.openItemDialog}
                    onRequestClose={() => {
                        this.setState({ openItemDialog: false, selectedItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <Subheader>Assigned Policies</Subheader>
                        <ItemPicker
                            height='250px'
                            selectedPolicies={this.state.itemConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ itemConfig: update(this.state.itemConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        };

        let renderNewPolicyDialog = () => {
            const actions = [
                <FlatButton
                    label='Cancel'
                    onTouchTap={() => {
                        this.setState({ openNewItemDialog: false, newItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label='Save'
                    primary={true}
                    onTouchTap={() => {
                        this.createUpdateItem(`${this.state.selectedTab}/${this.state.newItemId}`);
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Adding new ${this.state.selectedTab}`}
                    modal={false}
                    actions={actions}
                    open={this.state.openNewItemDialog}
                    onRequestClose={() => {
                        this.setState({ openNewItemDialog: false, newItemId: '' });
                        history.push(this.state.baseUrl);
                    }}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <TextField
                            className={styles.textFieldStyle}
                            hintText='Enter the new name'
                            floatingLabelFixed={true}
                            floatingLabelText='Name'
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newItemId: e.target.value });
                            }}
                        />
                        <Subheader>Assigned Policies</Subheader>
                        <ItemPicker
                            height='250px'
                            selectedPolicies={this.state.itemConfig.policies}
                            onSelectedChange={(newPolicies) => {
                                this.setState({ itemConfig: update(this.state.itemConfig, { policies: { $set: newPolicies } }) });
                            }}
                        />
                    </List>
                </Dialog>
            );
        };

        return (
            <div>
                {this.state.openItemDialog && renderPolicyDialog()}
                {this.state.openNewItemDialog && renderNewPolicyDialog()}
                <Tabs
                    onChange={(e) => {
                        history.push(`${this.state.baseUrl}${e}/`);
                        this.setState({ newConfig: _.clone(this.state.config) });
                    }}
                    value={this.state.selectedTab}
                >
                    <Tab
                        label='Manage LDAP Groups'
                        value='groups'
                        onActive={() => {
                            this.setState({ selectedTab: 'groups' });
                        }}
                        disabled={!this.state.isBackendConfigured}
                    >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure LDAP Groups.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <Toolbar>
                                <ToolbarGroup firstChild={true}>
                                    <FlatButton
                                        primary={true}
                                        label='NEW ROLE'
                                        onTouchTap={() => {
                                            this.setState({
                                                newItemId: '',
                                                openNewItemDialog: true,
                                                itemConfig: _.clone(this.itemConfigSchema)
                                            })
                                        }}
                                    />
                                </ToolbarGroup>
                            </Toolbar>
                            <ItemList
                                itemList={this.state.groups}
                                itemUri={`${this.state.baseVaultPath}/groups`}
                                onDeleteTap={(deletedItem) => {
                                    snackBarMessage(`Ldap group '${deletedItem}' deleted`);
                                    this.listLdapGroups();
                                }}
                                onTouchTap={(item) => {
                                    tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/groups/${item}`)
                                        .then(() => {
                                            this.setState({ selectedItemId: `groups/${item}` });
                                            history.push(`${this.state.baseUrl}groups/${item}`);
                                        }).catch(() => {
                                            snackBarMessage(new Error('Access denied'));
                                        });

                                }}
                            />
                        </Paper>
                    </Tab>
                    <Tab
                        label='Configure Ldap'
                        value='backend'
                        onActive={() => this.setState({ selectedTab: 'backend' })}
                    >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can configure details to your Ldap server.
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <List>
                                <TextField
                                    hintText='ldaps://127.0.0.1'
                                    floatingLabelText='Url'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.url}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { url: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='cn=user'
                                    floatingLabelText='Bind DN'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.binddn}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { binddn: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='password'
                                    type="password"
                                    floatingLabelText='Bind Password'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.bindpass}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { bindpass: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='memberOf'
                                    floatingLabelText='Group Attribute'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.groupattr}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { groupattr: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='dc=mydomain,dc=local'
                                    floatingLabelText='Group filter'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.groupfilter}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { groupfilter: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='dc=mydomain,dc=local'
                                    floatingLabelText='Group DN'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.groupdn}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { groupdn: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='samaccountname'
                                    floatingLabelText='User attribute'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.userattr}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { userattr: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='dc=mydomain,dc=local'
                                    floatingLabelText='User DN'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.userdn}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { userdn: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='tls12'
                                    floatingLabelText='TLS Max version'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.tls_max_version}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { tls_max_version: { $set: e.target.value } }) });
                                    }}
                                />
                                <TextField
                                    hintText='tls10'
                                    floatingLabelText='TLS Min version'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    value={this.state.newConfig.tls_min_version}
                                    onChange={(e) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { tls_min_version: { $set: e.target.value } }) });
                                    }}
                                />
                                <Checkbox
                                    checked={this.state.newConfig.insecure_tls}
                                    label='Use Insecure TLS'
                                    fullWidth={true}
                                    onCheck={(e, checked) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { insecure_tls: { $set: checked } }) });
                                    }}
                                />
                                <Checkbox
                                    checked={this.state.newConfig.starttls}
                                    label='Start TLS'
                                    fullWidth={true}
                                    floatingLabelFixed={true}
                                    onCheck={(e, checked) => {
                                        this.setState({ newConfig: update(this.state.newConfig, { starttls: { $set: checked } }) });
                                    }}
                                />
                                <div style={{ paddingTop: '20px', textAlign: 'center' }}>
                                    <FlatButton
                                        primary={true}
                                        label='Save'
                                        onTouchTap={() => this.createUpdateConfig()}
                                    />
                                </div>
                            </List>
                        </Paper>
                    </Tab>
                </Tabs>
            </div >
        );
    }
}
